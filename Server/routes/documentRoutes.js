const express = require('express');
const path = require('path');
const router = express.Router();
const documentService = require('../services/documentService');
const DocumentModel = require('../models/Document');
const { uploadDocument, DOCUMENT_MAX_BYTES, DOCUMENT_EXTENSIONS } = require('../middleware/upload');

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return value.toFixed(value >= 10 ? 0 : 1) + ' ' + units[unit];
};

// Enum + limit manifest so the frontend forms never drift from the schema.
router.get('/meta', (req, res) => {
  res.json({
    categories: DocumentModel.CATEGORIES,
    accessLevels: DocumentModel.ACCESS_LEVELS,
    publishStatuses: DocumentModel.PUBLISH_STATUSES,
    memoCategories: DocumentModel.MEMO_CATEGORIES,
    acceptedExtensions: DOCUMENT_EXTENSIONS,
    maxUploadBytes: DOCUMENT_MAX_BYTES,
    reviewSoonWindowDays: documentService.REVIEW_SOON_WINDOW_DAYS,
  });
});

// Dashboard analytics panel (Feature 4)
router.get('/stats', async (req, res) => {
  try {
    res.json(await documentService.getDocumentStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Known team members, for the active-member picker
router.get('/authors', async (req, res) => {
  try {
    res.json(await documentService.getDocumentAuthors());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Distinct tags for the repository filter chips
router.get('/tags', async (req, res) => {
  try {
    res.json(await documentService.getDocumentTags(req.query.category));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Store a file and hand back its URL + derived metadata. Kept separate from
// document creation so the upload can complete (and show a filled dropzone)
// while the user is still filling in the rest of the form.
router.post('/upload', uploadDocument.single('documentFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.status(201).json({
    fileUrl: '/uploads/documents/' + req.file.filename,
    fileName: req.file.originalname,
    fileType: path.extname(req.file.originalname).replace('.', '').toUpperCase(),
    fileSize: formatBytes(req.file.size),
  });
});

router.get('/', async (req, res) => {
  try {
    res.json(await documentService.getAllDocuments(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await documentService.getDocumentById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await documentService.createDocument(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await documentService.updateDocument(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Version control (supersede the live file/memo, archive the previous state)
router.post('/:id/versions', async (req, res) => {
  try {
    res.status(201).json(await documentService.addDocumentVersion(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await documentService.setDocumentArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await documentService.deleteDocument(req.params.id);
    res.json({ message: 'Document deleted', item: deleted });
  } catch (error) {
    // "Archive it first" is a refused precondition, not a missing record.
    const status = error.message === 'Document not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// --- Engagement (Feature 4) ---
router.post('/:id/view', async (req, res) => {
  try {
    res.json(await documentService.recordDocumentView(req.params.id, req.body.viewer));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/:id/download', async (req, res) => {
  try {
    res.json(await documentService.recordDocumentDownload(req.params.id, req.body.viewer));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// --- Comments (Feature 2) ---
router.post('/:id/comments', async (req, res) => {
  try {
    res.status(201).json(await documentService.addDocumentComment(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    res.json(await documentService.deleteDocumentComment(req.params.id, req.params.commentId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Multer rejections (oversize file, unsupported type) surface as 400s here
// rather than falling through to the generic 500 handler.
router.use((err, req, res, next) => {
  if (err) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum upload size is ' +
          Math.round(DOCUMENT_MAX_BYTES / 1024 / 1024) +
          'MB — register larger files as an external link instead.'
        : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
