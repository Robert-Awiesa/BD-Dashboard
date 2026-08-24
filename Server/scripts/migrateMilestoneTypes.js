/**
 * 'Team Birthday' and 'Work Anniversary' merged into a single 'Team Member'
 * record carrying both dates, because filing the same person twice produced two
 * half-pictures and no way to see them together.
 *
 * Merge rule, per person (matched on name + department):
 *   - the Team Birthday record keeps milestoneMonth/Day as the birthday
 *   - the Work Anniversary record contributes originalStartDate
 *   - the surviving record becomes 'Team Member'; the duplicate is removed
 *
 * A Work Anniversary with no matching birthday cannot become a complete
 * Team Member — nobody recorded the birthday — so it is converted and flagged
 * isDraft, which keeps it out of the reminder sweep until someone fills it in.
 *
 * Run once:  node scripts/migrateMilestoneTypes.js
 * Safe to re-run: every step is idempotent.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const key = (d) => `${(d.participantName || '').trim().toLowerCase()}::${(d.departmentOrCompany || '').trim().toLowerCase()}`;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'bd_workspace' });

  // Raw, so the new enum does not hide the documents we are here to fix.
  const raw = mongoose.connection.collection('milestones');
  const docs = await raw.find({}).toArray();

  const birthdays = new Map();
  const anniversaries = new Map();
  for (const d of docs) {
    if (d.milestoneType === 'Team Birthday') birthdays.set(key(d), d);
    if (d.milestoneType === 'Work Anniversary') anniversaries.set(key(d), d);
  }

  let merged = 0;
  let drafted = 0;
  let converted = 0;

  for (const [k, birthday] of birthdays) {
    const anniversary = anniversaries.get(k);
    const set = { milestoneType: 'Team Member' };

    if (anniversary) {
      // The anniversary record knows when they started; the birthday record
      // knows the birthday. Keep both on the survivor.
      set.originalStartDate = anniversary.originalStartDate || null;
      if (!set.originalStartDate) set.isDraft = true;
      await raw.updateOne({ _id: birthday._id }, { $set: set });
      await raw.deleteOne({ _id: anniversary._id });
      anniversaries.delete(k);
      merged += 1;
    } else {
      // A birthday with no work start date is a Team Member we cannot chase
      // for a work anniversary yet.
      if (!birthday.originalStartDate) set.isDraft = true;
      await raw.updateOne({ _id: birthday._id }, { $set: set });
      converted += 1;
    }
  }

  // Anniversaries with no matching birthday: nobody recorded the birthday, so
  // the record is incomplete by the new rules.
  for (const [, anniversary] of anniversaries) {
    await raw.updateOne(
      { _id: anniversary._id },
      { $set: { milestoneType: 'Team Member', isDraft: true } }
    );
    drafted += 1;
  }

  console.log(`\n${docs.length} milestone(s) scanned:`);
  console.log(`  ${merged} merged birthday + anniversary into one Team Member`);
  console.log(`  ${converted} birthday-only record(s) converted`);
  console.log(`  ${drafted} anniversary-only record(s) converted and flagged as drafts`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
