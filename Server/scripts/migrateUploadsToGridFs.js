/**
 * Move files off the container's disk and into GridFS.
 *
 * Uploads used to be written to Server/uploads/. Render's filesystem is
 * ephemeral, so those files disappeared on every deploy while the database rows
 * kept pointing at them — the 404s in the media hub. Storage moved to GridFS;
 * this carries across whatever is still on disk locally.
 *
 * Anything already in GridFS is skipped, so this is safe to re-run. Files the
 * deployment already lost cannot be recovered by any script — they are gone,
 * and their rows are reported at the end so somebody can re-upload them.
 *
 * Run:  node scripts/migrateUploadsToGridFs.js
 *       MONGODB_DB_NAME=robertawiesa_db_user node scripts/migrateUploadsToGridFs.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const fileStore = require('../services/fileStore');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

// Every place a stored file is referenced, so missing ones can be named.
const REFERENCES = [
  'documents', 'contents', 'events', 'interactions', 'milestones',
  'socialcontents', 'eois', 'tenders', 'dgevents', 'clients',
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const dbName = process.env.MONGODB_DB_NAME || 'bd_workspace';
  await mongoose.connect(uri, { dbName });
  console.log(`  database: ${dbName}\n`);

  let moved = 0;
  let skipped = 0;

  for (const bucket of fileStore.BUCKETS) {
    const dir = path.join(UPLOAD_ROOT, bucket);
    if (!fs.existsSync(dir)) continue;

    for (const filename of fs.readdirSync(dir)) {
      if (filename === '.gitkeep') continue;
      const full = path.join(dir, filename);
      if (!fs.statSync(full).isFile()) continue;

      // Already carried across on an earlier run.
      const existing = await mongoose.connection
        .collection(`uploads_${bucket}.files`)
        .findOne({ filename });
      if (existing) {
        skipped += 1;
        continue;
      }

      // Keep the name: the URL in the database is built from it.
      const buffer = fs.readFileSync(full);
      await new Promise((resolve, reject) => {
        const stream = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: `uploads_${bucket}`,
        }).openUploadStream(filename, {
          metadata: { originalname: filename, uploadedAt: new Date(), migratedFromDisk: true },
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(buffer);
      });
      moved += 1;
      console.log(`  ${bucket}/${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    }
  }

  // Which referenced files still have nothing behind them.
  const referenced = new Set();
  for (const collection of REFERENCES) {
    const rows = await mongoose.connection.collection(collection).find({}).toArray().catch(() => []);
    for (const row of rows) {
      for (const url of JSON.stringify(row).match(/\/uploads\/[a-z]+\/[^"\\]+/g) || []) {
        referenced.add(url);
      }
    }
  }

  const lost = [];
  for (const url of referenced) {
    const [, , bucket, filename] = url.split('/');
    if (!fileStore.BUCKETS.includes(bucket)) continue;
    const found = await mongoose.connection
      .collection(`uploads_${bucket}.files`)
      .findOne({ filename });
    if (!found) lost.push(url);
  }

  console.log(`\n${moved} file(s) moved into the database, ${skipped} already there.`);
  if (lost.length) {
    console.log(`\n${lost.length} referenced file(s) no longer exist anywhere — they were lost to an`);
    console.log('earlier deploy and need re-uploading:');
    lost.forEach((u) => console.log(`  ${u}`));
  } else {
    console.log('Every referenced file resolves.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
