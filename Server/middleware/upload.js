const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const SCRIPTS_DIR = path.join(UPLOAD_ROOT, 'scripts');
const COVERS_DIR = path.join(UPLOAD_ROOT, 'covers');
const MEDIA_DIR = path.join(UPLOAD_ROOT, 'media');
const DOCUMENTS_DIR = path.join(UPLOAD_ROOT, 'documents');
const ASSETS_DIR = path.join(UPLOAD_ROOT, 'assets');
const VISITS_DIR = path.join(UPLOAD_ROOT, 'visits');
const EOIS_DIR = path.join(UPLOAD_ROOT, 'eois');

for (const dir of [SCRIPTS_DIR, COVERS_DIR, MEDIA_DIR, DOCUMENTS_DIR, ASSETS_DIR, VISITS_DIR, EOIS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const makeStorage = (destDir) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${unique}${ext}`);
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
  storage: makeStorage(SCRIPTS_DIR),
  fileFilter: scriptFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

exports.uploadCoverImage = multer({
  storage: makeStorage(COVERS_DIR),
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

  if (isImage || isAudio) return cb(null, true);

  // Match on extension as well as mimetype — uploads arriving as
  // application/octet-stream should still get the specific video guidance.
  const isVideo = file.mimetype.startsWith('video/')
    || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext);
  if (isVideo) {
    return cb(new Error('Video is not uploaded here — add the recording as a link (SharePoint, YouTube or Drive) instead.'));
  }
  cb(new Error('Only image or audio files can be uploaded. Use a link for anything else.'));
};

exports.uploadMedia = multer({
  storage: makeStorage(MEDIA_DIR),
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
  storage: makeStorage(DOCUMENTS_DIR),
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
  storage: makeStorage(ASSETS_DIR),
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
  storage: makeStorage(VISITS_DIR),
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
  storage: makeStorage(EOIS_DIR),
  fileFilter: eoiFileFilter,
  limits: { fileSize: EOI_MAX_BYTES },
});

exports.EOI_MAX_BYTES = EOI_MAX_BYTES;

exports.MEDIA_MAX_BYTES = MEDIA_MAX_BYTES;
exports.UPLOAD_ROOT = UPLOAD_ROOT;
