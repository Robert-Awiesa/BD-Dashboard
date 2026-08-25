/**
 * File storage that survives a deploy.
 *
 * Uploads were written to the container's own filesystem. Render's disk is
 * ephemeral, so every document, visit photo and tender clipping disappeared on
 * the next deploy — the database rows survived and pointed at files that were
 * no longer there, which is exactly the 404s the media hub was showing.
 *
 * Files now live in MongoDB via GridFS: the same database the rest of the
 * workspace already uses, so there is no second service to sign up for, no
 * extra credential, and no separate thing to back up. GridFS chunks a file
 * across documents, so nothing is limited by the 16MB document ceiling.
 *
 * The URL shape is unchanged — /uploads/<bucket>/<filename> — so every row
 * already stored keeps working and no module needed touching.
 *
 * The real constraint is the cluster: an Atlas free tier holds 512MB in total,
 * shared with all the actual records. That is why the per-file limits in
 * middleware/upload.js are what they are. A big video belongs behind a link
 * (the media hub already asks for one), not inside the database.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

// One bucket per kind of upload, so a bad batch of one kind can be cleared
// without touching the others.
const BUCKETS = ['scripts', 'covers', 'media', 'documents', 'assets', 'visits', 'eois', 'tenders'];

const bucketFor = (name) => {
  if (!BUCKETS.includes(name)) throw new Error(`Unknown upload bucket "${name}"`);
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database is not connected — uploads are stored in it');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: `uploads_${name}` });
};

/** The same collision-proof name the disk storage used, so URLs look identical. */
const makeFilename = (originalname) => {
  const unique = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${unique}${path.extname(originalname || '')}`;
};

/**
 * Store a buffer and return what the callers already expect from multer:
 * a filename, the original name, size and mimetype.
 */
exports.save = (bucketName, file) =>
  new Promise((resolve, reject) => {
    const filename = makeFilename(file.originalname);
    const stream = bucketFor(bucketName).openUploadStream(filename, {
      // The driver drops a top-level contentType, so the real one is kept in
      // metadata — without it every file came back as octet-stream and the
      // browser would offer a download instead of showing the image.
      contentType: file.mimetype,
      metadata: {
        contentType: file.mimetype || '',
        originalname: file.originalname,
        uploadedAt: new Date(),
      },
    });
    stream.on('error', reject);
    stream.on('finish', () =>
      resolve({
        filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/${bucketName}/${filename}`,
      })
    );
    stream.end(file.buffer);
  });

// Last resort when nothing recorded a type: the extension is usually right,
// and a wrong guess is still better than octet-stream on an image.
const TYPE_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Stream a stored file to the response, or 404 if it is not there. */
exports.stream = async (bucketName, filename, res) => {
  const bucket = bucketFor(bucketName);
  const [record] = await bucket.find({ filename }).limit(1).toArray();
  if (!record) return false;

  const type = record.metadata?.contentType
    || record.contentType
    || TYPE_BY_EXT[path.extname(filename).toLowerCase()]
    || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', record.length);
  // Filenames are unique per upload, so a stored file never changes.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  await new Promise((resolve, reject) => {
    const download = bucket.openDownloadStreamByName(filename);
    download.on('error', reject);
    download.on('end', resolve);
    download.pipe(res);
  });
  return true;
};

exports.remove = async (bucketName, filename) => {
  const bucket = bucketFor(bucketName);
  const [record] = await bucket.find({ filename }).limit(1).toArray();
  if (!record) return false;
  await bucket.delete(record._id);
  return true;
};

/**
 * Files stored by an upload that a route then rejected. multer only cleans up
 * when multer itself refuses; a business-rule rejection afterwards left the
 * file behind with nothing pointing at it.
 */
exports.removeQuietly = async (bucketName, filename, resourceType) => {
  try {
    const cloudinaryStore = require('./cloudinaryStore');
    if (cloudinaryStore.isConfigured()) {
      await cloudinaryStore.remove(bucketName, filename, resourceType || 'image');
      return;
    }
    await exports.remove(bucketName, filename);
  } catch {
    // Cleanup must never turn a handled rejection into a 500.
  }
};

exports.BUCKETS = BUCKETS;
