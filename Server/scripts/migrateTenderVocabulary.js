/**
 * One-off migration for the Tenders vocabulary change.
 *
 * `tenderType` moved from Stage One / Stage Two / Single Stage / Framework to
 * Opened / Restrictive / Negotiated, and `sector` became an enum shared with
 * Cold Calls. Records written before that carry values the schema now rejects,
 * which would make them unsaveable — an edit would fail on a field the person
 * editing never touched.
 *
 * Run once:  node scripts/migrateTenderVocabulary.js
 * Safe to re-run: every step is idempotent.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Tender = require('../models/Tender');

const TYPE_MAP = {
  // The old values described bidding STAGES, not procurement method. Anything
  // that was open to all bidders becomes 'Opened'; a framework is a
  // pre-qualified list, which is what 'Restrictive' means.
  'Single Stage': 'Opened',
  'Stage One': 'Opened',
  'Stage Two': 'Restrictive',
  Framework: 'Restrictive',
};

const SECTORS = ['Oil and Gas', 'Manufacturing', 'Mining', 'Logistics', 'Financial', 'Others'];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'bd_workspace' });

  // Read raw: going through the model would apply the new enums to old values
  // and hide exactly the documents we are here to fix.
  const raw = mongoose.connection.collection('tenders');
  const docs = await raw.find({}).toArray();

  let types = 0;
  let sectors = 0;

  for (const doc of docs) {
    const set = {};

    if (doc.tenderType && !['Opened', 'Restrictive', 'Negotiated'].includes(doc.tenderType)) {
      set.tenderType = TYPE_MAP[doc.tenderType] || 'Opened';
      types += 1;
    }

    // A free-text sector that is not one of the six is kept verbatim in
    // customSector, so nothing typed by a person is thrown away.
    if (doc.sector && !SECTORS.includes(doc.sector)) {
      set.sector = 'Others';
      set.customSector = doc.customSector || doc.sector;
      sectors += 1;
    }

    if (Object.keys(set).length) {
      await raw.updateOne({ _id: doc._id }, { $set: set });
      console.log(`  ${doc.title?.slice(0, 60)} → ${JSON.stringify(set)}`);
    }
  }

  console.log(`\n${docs.length} tender(s) scanned: ${types} type(s), ${sectors} sector(s) migrated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
