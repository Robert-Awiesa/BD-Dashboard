/**
 * "Online" became "Virtual", and the single locationDetails field split into
 * locationDetails + streamingLink so a hybrid event can carry both.
 *
 * Records written before that hold a modality the schema now rejects, and
 * online events keep their join URL in locationDetails where the UI no longer
 * looks for it.
 *
 * Run once:  node scripts/migrateEventModality.js
 * Safe to re-run: every step is idempotent.
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'bd_workspace' });

  // Raw, so the new enum does not hide the documents we are here to fix.
  const raw = mongoose.connection.collection('events');
  const docs = await raw.find({}).toArray();

  let moved = 0;
  for (const doc of docs) {
    const set = {};
    if (doc.modality === 'Online') {
      set.modality = 'Virtual';
      // An online event's "location" was always the join URL.
      if (doc.locationDetails && !doc.streamingLink) {
        set.streamingLink = doc.locationDetails;
        set.locationDetails = '';
      }
    }
    if (Object.keys(set).length) {
      await raw.updateOne({ _id: doc._id }, { $set: set });
      console.log(`  ${(doc.title || '').slice(0, 55)} → ${JSON.stringify(set)}`);
      moved += 1;
    }
  }

  console.log(`\n${docs.length} event(s) scanned, ${moved} migrated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
