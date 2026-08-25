/**
 * Cloudinary storage, used when it is configured.
 *
 * GridFS solved the disappearing-files problem, but it puts every upload inside
 * a 512MB Atlas cluster that also holds the records. Cloudinary keeps the files
 * out of the database entirely and serves them from a CDN, which is what you
 * want for photos and video.
 *
 * Configuration is optional on purpose: with no credentials the workspace falls
 * back to GridFS, so a local checkout works with nothing to set up and nobody
 * has to hold production secrets to run the app.
 *
 * Accepts either form Cloudinary hands out:
 *   CLOUDINARY_URL=cloudinary://key:secret@cloud-name
 * or the three separate values:
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 */
const cloudinary = require('cloudinary').v2;
const path = require('path');

const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER || 'bd-workspace';

const readConfig = () => {
  if (process.env.CLOUDINARY_URL) return { url: true };
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (cloud_name && api_key && api_secret) return { cloud_name, api_key, api_secret };
  return null;
};

let configured = false;

/** True once credentials are present, so callers can pick a backend. */
exports.isConfigured = () => {
  const config = readConfig();
  if (!config) return false;
  if (!configured) {
    // CLOUDINARY_URL is read by the SDK on its own; the split form is not.
    if (!config.url) cloudinary.config({ ...config, secure: true });
    else cloudinary.config({ secure: true });
    configured = true;
  }
  return true;
};

// Cloudinary decides how to treat a file by resource_type. Getting this wrong
// is why a PDF can come back unusable — "image" covers PDFs, "video" covers
// audio too, and everything else has to be "raw".
const resourceTypeFor = (mimetype = '', filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  if (mimetype.startsWith('image/') || ext === '.pdf') return 'image';
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mp3', '.m4a', '.wav'].includes(ext)) {
    return 'video';
  }
  return 'raw';
};

/**
 * Upload a buffer and return the same shape the GridFS store returns, so the
 * multer engine does not care which backend is in use.
 */
exports.save = (bucketName, file) =>
  new Promise((resolve, reject) => {
    const resource_type = resourceTypeFor(file.mimetype, file.originalname);
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${FOLDER_PREFIX}/${bucketName}`,
        resource_type,
        // Keep the original extension in the delivered URL so downloads land
        // with a sensible filename.
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(new Error(error.message || 'Cloudinary upload failed'));
        resolve({
          filename: result.public_id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: result.bytes,
          // The delivered URL is absolute and served by the CDN, so it is
          // stored as-is rather than rewritten to /uploads/...
          url: result.secure_url,
          resourceType: resource_type,
        });
      }
    );
    stream.end(file.buffer);
  });

/** Remove by the public_id we stored as `filename`. */
exports.remove = async (bucketName, publicId, resourceType = 'image') => {
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  return result?.result === 'ok';
};

exports.resourceTypeFor = resourceTypeFor;
