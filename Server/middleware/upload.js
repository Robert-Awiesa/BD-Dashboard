const multer = require('multer');
const fileStore = require('../services/fileStore');
const cloudinaryStore = require('../services/cloudinaryStore');

// Cloudinary when it is configured, otherwise the database. Choosing per
// upload rather than at boot means adding the credentials takes effect on the
// next restart without a code change, and a local checkout needs no setup.
const storeFor = () => (cloudinaryStore.isConfigured() ? cloudinaryStore : fileStore);
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Serverless filesystems (Vercel, Lambda) are READ-ONLY outside the temp dir.
// mkdirSync against a read-only path throws EROFS, and because this module is
// pulled in at require-time by six route files, that error crashed the whole
// function during initialisation — every endpoint returned 500, including
// /api/health, which never touches the database.
//
// NOTE: os.tmpdir() is ephemeral and per-container. Uploads written there
// survive only until that container is recycled, so file storage on serverless
// needs a real object store (S3 / Vercel Blob / Cloudinary) to be durable.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const UPLOAD_ROOT = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'bd-uploads')
  : path.join(__dirname, '..', 'uploads');
const SCRIPTS_DIR = path.join(UPLOAD_ROOT, 'scripts');
const COVERS_DIR = path.join(UPLOAD_ROOT, 'covers');
const MEDIA_DIR = path.join(UPLOAD_ROOT, 'media');
const DOCUMENTS_DIR = path.join(UPLOAD_ROOT, 'documents');
const ASSETS_DIR = path.join(UPLOAD_ROOT, 'assets');
const VISITS_DIR = path.join(UPLOAD_ROOT, 'visits');
const EOIS_DIR = path.join(UPLOAD_ROOT, 'eois');
const TENDERS_DIR = path.join(UPLOAD_ROOT, 'tenders');

// Never let a filesystem problem take the whole API down at boot. A failure
// here only means uploads will not work; every other route stays up.
for (const dir of [SCRIPTS_DIR, COVERS_DIR, MEDIA_DIR, DOCUMENTS_DIR, ASSETS_DIR, VISITS_DIR, EOIS_DIR, TENDERS_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn(`Upload directory unavailable (${dir}): ${err.message}`);
  }
}

/**
 * Files go to GridFS in MongoDB, not to the container's disk.
 *
 * Render's filesystem is ephemeral: everything written to it disappeared on the
 * next deploy, leaving database rows pointing at files that no longer existed.
 * A custom multer engine keeps `upload.single('x')` and `req.file.filename`
 * working exactly as before, so no route needed changing.
 */
const makeStorage = (bucketName) => ({
  _handleFile(req, file, cb) {
    const chunks = [];
    let bytes = 0;
    file.stream.on('data', (chunk) => {
      chunks.push(chunk);
      bytes += chunk.length;
    });
    file.stream.on('error', cb);
    file.stream.on('end', async () => {
      try {
        const saved = await storeFor().save(bucketName, {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: bytes,
          buffer: Buffer.concat(chunks),
        });
        cb(null, {
          filename: saved.filename,
          size: bytes,
          // `url` is what the routes store. It is a CDN address on Cloudinary
          // and a /uploads/... path on GridFS, and neither route nor model
          // needs to know which.
          url: saved.url,
          path: saved.url,
          bucket: bucketName,
          resourceType: saved.resourceType || null,
        });
      } catch (err) {
        cb(err);
      }
    });
  },
  // Called when a later stage rejects the upload, so a refused file does not
  // sit in the database forever.
  _removeFile(req, file, cb) {
    if (!file?.filename) return cb(null);
    const store = storeFor();
    const done = () => cb(null);
    if (store === cloudinaryStore) {
      store.remove(bucketName, file.filename, file.resourceType || 'image').then(done, done);
    } else {
      store.remove(bucketName, file.filename).then(done, done);
    }
  },
});

const SCRIPT_MIME_TYPES = new Set([
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const scriptFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.txt', '.doc', '.docx'].includes(ext) || SCRIPT_MIME_TYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only .txt, .doc, or .docx files are allowed for scripts'));
};

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image files are allowed for cover images'));
};

exports.uploadScript = multer({
  storage: makeStorage('scripts'),
  fileFilter: scriptFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

exports.uploadCoverImage = multer({
  storage: makeStorage('covers'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Media Hub: photos and podcast audio are hosted locally. Recorded video is
// deliberately NOT accepted here — a 1–2GB webinar recording belongs on
// SharePoint/YouTube and is attached to the archive as a link instead, so the
// project folder doesn't grow into tens of gigabytes.
const MEDIA_MAX_BYTES = 200 * 1024 * 1024;

const mediaFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = file.mimetype.startsWith('image/');
  const isAudio = file.mimetype.startsWith('audio/') || ['.mp3', '.m4a', '.wav', '.aac', '.ogg'].includes(ext);

  // Match on extension as well as mimetype — uploads arriving as
  // application/octet-stream should still be recognised.
  const isVideo = file.mimetype.startsWith('video/')
    || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext);

  // Video is allowed now. Size is the real constraint, and multer enforces it
  // with MEDIA_MAX_BYTES — a clip that fits belongs in the archive as much as
  // a photo does. Anything larger is turned into a link request by the UI.
  if (isImage || isAudio || isVideo) return cb(null, true);

  cb(new Error('Only image, audio or video files can be uploaded. Use a link for anything else.'));
};

exports.uploadMedia = multer({
  storage: makeStorage('media'),
  fileFilter: mediaFileFilter,
  limits: { fileSize: MEDIA_MAX_BYTES },
});

// Reports & Documentation hub: the knowledge repository accepts the office
// formats teams actually circulate, plus short video for recorded training.
// Anything larger than the cap belongs on SharePoint/Drive and is registered
// here as an external link instead.
const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;

const DOCUMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md', '.csv', '.mp4',
];

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (DOCUMENT_EXTENSIONS.includes(ext)) return cb(null, true);
  cb(new Error(`Unsupported file type "${ext}". Allowed: ${DOCUMENT_EXTENSIONS.join(', ')}`));
};

exports.uploadDocument = multer({
  storage: makeStorage('documents'),
  fileFilter: documentFileFilter,
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

exports.DOCUMENT_MAX_BYTES = DOCUMENT_MAX_BYTES;
exports.DOCUMENT_EXTENSIONS = DOCUMENT_EXTENSIONS;

// Blog & Content CMS asset library. Unlike the Media Hub this *does* accept
// short video — a 15-second product mockup or testimonial clip is exactly the
// brand collateral a DAM is for. The cap keeps full webinar recordings out;
// those still belong on SharePoint/YouTube as a link.
const ASSET_MAX_BYTES = 50 * 1024 * 1024;

const ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.pdf'];

const assetFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ASSET_EXTENSIONS.includes(ext)) return cb(null, true);
  cb(new Error(`Unsupported asset type "${ext}". Allowed: ${ASSET_EXTENSIONS.join(', ')}`));
};

exports.uploadAsset = multer({
  storage: makeStorage('assets'),
  fileFilter: assetFileFilter,
  limits: { fileSize: ASSET_MAX_BYTES },
});

exports.ASSET_MAX_BYTES = ASSET_MAX_BYTES;
exports.ASSET_EXTENSIONS = ASSET_EXTENSIONS;

// Field visit photos: site conditions, installed equipment, the team on site.
// Images only, and generously capped — these come straight off a phone camera.
const VISIT_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

const visitPhotoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image files can be attached to a visit report.'));
};

exports.uploadVisitPhoto = multer({
  storage: makeStorage('visits'),
  fileFilter: visitPhotoFilter,
  limits: { fileSize: VISIT_PHOTO_MAX_BYTES },
});

exports.VISIT_PHOTO_MAX_BYTES = VISIT_PHOTO_MAX_BYTES;

// EOI notices: a clipping, a WhatsApp screenshot, a scanned note. Images and
// PDFs only — anything bigger belongs on SharePoint/Drive as a link.
const EOI_MAX_BYTES = 15 * 1024 * 1024;

const EOI_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];

const eoiFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EOI_EXTENSIONS.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error(`Unsupported file type. Allowed: ${EOI_EXTENSIONS.join(', ')} (or a PDF/image).`));
};

exports.uploadEoi = multer({
  storage: makeStorage('eois'),
  fileFilter: eoiFileFilter,
  limits: { fileSize: EOI_MAX_BYTES },
});

exports.EOI_MAX_BYTES = EOI_MAX_BYTES;

// Tender source evidence: the newspaper clipping, the WhatsApp screenshot.
// Same shape and limits as EOI notices — it is the same kind of artefact.
exports.uploadTender = multer({
  storage: makeStorage('tenders'),
  fileFilter: eoiFileFilter,
  limits: { fileSize: EOI_MAX_BYTES },
});

exports.MEDIA_MAX_BYTES = MEDIA_MAX_BYTES;
exports.UPLOAD_ROOT = UPLOAD_ROOT;
