/**
 * The DG lifecycle moved from five generic phases to the seven stages the
 * event actually runs through, each seeded with its own activities.
 *
 *   Conceptualization & Budgeting          →  Strategic Planning
 *   Team Inputs & Departmental Assignment  →  Strategic Planning
 *   Stakeholder & Guest Outreach           →  Attendance Confirmation
 *   Execution & Live Coordination          →  Final Event Setup
 *   Post-Event Evaluation & Archival       →  Final Event Setup
 *
 * Old phase names fail the new enum, so those records cannot be saved at all
 * until this runs. Any task somebody had added is carried onto the stage its
 * old phase maps to rather than dropped, and a task that cannot be placed goes
 * to Strategic Planning so it is still in front of somebody.
 *
 * A stored budgetSpent becomes a single expense on Strategic Planning, because
 * the figure is now the sum of the expenses behind it — leaving it out would
 * silently reset the spend to zero.
 *
 * Run once:  node scripts/migrateDgStages.js
 * Safe to re-run: an already-migrated event is left alone.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const DgEvent = require('../models/DgEvent');

const NEW_STAGES = DgEvent.PHASES;
const SPEC = DgEvent.STAGE_SPEC;

const OLD_TO_NEW = {
  'Conceptualization & Budgeting': 'Strategic Planning',
  'Team Inputs & Departmental Assignment': 'Strategic Planning',
  'Stakeholder & Guest Outreach': 'Attendance Confirmation',
  'Execution & Live Coordination': 'Final Event Setup',
  'Post-Event Evaluation & Archival': 'Final Event Setup',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'bd_workspace' });

  // Raw, so the new enum does not hide the documents we are here to fix.
  const raw = mongoose.connection.collection('dgevents');
  const docs = await raw.find({}).toArray();

  let migrated = 0;
  let carried = 0;

  for (const doc of docs) {
    const already = (doc.phases || []).every((p) => NEW_STAGES.includes(p.name));
    if (already && doc.budgetSpent === undefined) {
      console.log(`  ${doc.dgEventTitle}: already on the new stages`);
      continue;
    }

    // Where each old task should land.
    const tasksFor = new Map(NEW_STAGES.map((n) => [n, []]));
    for (const phase of doc.phases || []) {
      const target = NEW_STAGES.includes(phase.name)
        ? phase.name
        : OLD_TO_NEW[phase.name] || 'Strategic Planning';
      for (const task of phase.tasks || []) {
        tasksFor.get(target).push(task);
        carried += 1;
      }
    }

    const phases = NEW_STAGES.map((name, idx) => ({
      name,
      order: idx + 1,
      summary: '',
      owner: '',
      blocked: false,
      blockedReason: '',
      attributes: {},
      // The stage's standard activities, plus anything carried over.
      tasks: [
        ...(SPEC[name]?.activities || []).map((taskName) => ({
          _id: new mongoose.Types.ObjectId(),
          taskName,
          completed: false,
        })),
        ...tasksFor.get(name),
      ],
      expenses: [],
    }));

    // A spend figure that was typed in becomes a real expense, so the new
    // derived total starts from the same number rather than from zero.
    const spent = Number(doc.budgetSpent) || 0;
    if (spent > 0) {
      phases[0].expenses.push({
        _id: new mongoose.Types.ObjectId(),
        description: 'Spend recorded before expenses were itemised',
        amount: spent,
        incurredAt: doc.updatedAt || new Date(),
        paidBy: '',
        notes: 'Carried over from the single budgetSpent figure.',
      });
    }

    await raw.updateOne(
      { _id: doc._id },
      { $set: { phases }, $unset: { budgetSpent: '' } }
    );
    migrated += 1;
    console.log(`  ${doc.dgEventTitle}: 7 stages, ${spent > 0 ? `${spent} carried as an expense, ` : ''}${phases.reduce((n, p) => n + p.tasks.length, 0)} activities`);
  }

  console.log(`\n${docs.length} DG event(s) scanned, ${migrated} migrated, ${carried} existing task(s) carried over.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
