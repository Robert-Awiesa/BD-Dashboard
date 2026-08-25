/**
 * Move whatever is already in GridFS up to Cloudinary.
 *
 * Storage moved to Cloudinary once its credentials were added. Files uploaded
 * before that are still in the database and still served by /uploads/..., so
 * nothing is broken — but leaving them there means two stores to reason about,
 * and they keep occupying the Atlas cluster the records share.
 *
 * Every row that references a moved file is rewritten to the CDN URL. Rows are
 * matched on the exact URL string, so a file nothing points at is uploaded and
 * reported rather than silently rewritten into nowhere.
 *
 * Run:  node scripts/migrateGridFsToCloudinary.js
 *       MONGODB_DB_NAME=robertawiesa_db_user node scripts/migrateGridFsToCloudinary.js
 *
 * Safe to re-run: a bucket with nothing left in it is skipped.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const fileStore = require('../services/fileStore');
const cloudinaryStore = require('../services/cloudinaryStore');

// Every collection that can hold a file URL.
const COLLECTIONS = [
  'documents', 'contents', 'events', 'interactions', 'milestones',
  'socialcontents', 'eois', 'tenders', 'dgevents', 'clients',
];

async function run() {
  if (!cloudinaryStore.isConfigured()) {
    throw new Error('Cloudinary is not configured — nothing to move files to');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const dbName = process.env.MONGODB_DB_NAME || 'bd_workspace';
  await mongoose.connect(uri, { dbName });
  console.log(`  database: ${dbName}\n`);

  let moved = 0;
  let rewritten = 0;
  let empty = 0;
  const orphans = [];
  const failed = [];

  for (const bucket of fileStore.BUCKETS) {
    const files = await mongoose.connection
      .collection(`uploads_${bucket}.files`)
      .find({})
      .toArray()
      .catch(() => []);
    if (!files.length) continue;

    const gridfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: `uploads_${bucket}`,
    });

    for (const record of files) {
      // Read it back out of GridFS.
      const buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        const stream = gridfs.openDownloadStream(record._id);
        stream.on('data', (c) => chunks.push(c));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });

      // A zero-byte file is junk from a failed upload — Cloudinary rejects it
      // and there is nothing worth keeping.
      if (!buffer.length) {
        await gridfs.delete(record._id);
        empty += 1;
        console.log(`  ${bucket}/${record.filename} -> empty, discarded`);
        continue;
      }

      let saved;
      try {
        saved = await cloudinaryStore.save(bucket, {
          originalname: record.metadata?.originalname || record.filename,
          mimetype: record.metadata?.contentType || record.contentType || '',
          size: record.length,
          buffer,
        });
      } catch (err) {
        // One unusable file must not strand the rest half-migrated.
        failed.push(`${bucket}/${record.filename}: ${err.message}`);
        continue;
      }
      moved += 1;

      // Point every row that referenced it at the new address.
      const oldUrl = `/uploads/${bucket}/${record.filename}`;
      let hits = 0;
      for (const name of COLLECTIONS) {
        const col = mongoose.connection.collection(name);
        const rows = await col.find({}).toArray().catch(() => []);
        for (const row of rows) {
          const json = JSON.stringify(row);
          if (!json.includes(oldUrl)) continue;
          const patched = JSON.parse(json.split(oldUrl).join(saved.url));
          delete patched._id;
          await col.updateOne({ _id: row._id }, { $set: patched });
          hits += 1;
        }
      }
      rewritten += hits;
      if (hits === 0) orphans.push(oldUrl);
      console.log(`  ${bucket}/${record.filename} -> ${hits} row(s) updated`);

      await gridfs.delete(record._id);
    }
  }

  console.log(`\n${moved} file(s) moved to Cloudinary, ${rewritten} row reference(s) rewritten.`);
  if (orphans.length) {
    console.log(`\n${orphans.length} moved file(s) had nothing pointing at them:`);
    orphans.forEach((u) => console.log(`  ${u}`));
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
