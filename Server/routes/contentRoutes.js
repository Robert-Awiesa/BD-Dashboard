const express = require('express');
const path = require('path');
const router = express.Router();
const contentService = require('../services/contentService');
const ContentModel = require('../models/Content');
const { uploadAsset, ASSET_MAX_BYTES, ASSET_EXTENSIONS } = require('../middleware/upload');

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

// Enum manifest, so the dynamic forms never drift from the schema.
router.get('/meta', (req, res) => {
  res.json({
    contentTypes: ContentModel.CONTENT_TYPES,
    statuses: ContentModel.STATUSES,
    assetCategories: ContentModel.ASSET_CATEGORIES,
    objectionCategories: ContentModel.OBJECTION_CATEGORIES,
    leadMagnetStatuses: ContentModel.LEAD_MAGNET_STATUSES,
    acceptedExtensions: ASSET_EXTENSIONS,
    maxUploadBytes: ASSET_MAX_BYTES,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await contentService.getContentStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tags', async (req, res) => {
  try {
    res.json(await contentService.getContentTags(req.query.contentType));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/sectors', async (req, res) => {
  try {
    res.json(await contentService.getContentSectors());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/authors', async (req, res) => {
  try {
    res.json(await contentService.getContentAuthors());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// The Assets library, powering the cover-image and client-logo pickers.
router.get('/assets', async (req, res) => {
  try {
    res.json(await contentService.getAssetLibrary());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Store a file and return its URL + derived metadata, so the dropzone can show
// it as attached while the rest of the form is still being filled in.
router.post('/upload', uploadAsset.single('assetFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.status(201).json({
    fileUrl: '/uploads/assets/' + req.file.filename,
    fileName: req.file.originalname,
    fileType: path.extname(req.file.originalname).replace('.', '').toUpperCase(),
    fileSize: formatBytes(req.file.size),
  });
});

router.get('/', async (req, res) => {
  try {
    res.json(await contentService.getAllContent(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await contentService.getContentById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await contentService.createContent(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await contentService.updateContent(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await contentService.setContentArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await contentService.deleteContent(req.params.id);
    res.json({ message: 'Content deleted', item: deleted });
  } catch (error) {
    // "Archive it first" / "still in use" are refused preconditions, not 404s.
    const status = error.message === 'Content item not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

router.post('/:id/view', async (req, res) => {
  try {
    res.json(await contentService.recordContentView(req.params.id, req.body.actor));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Bumped when an asset is downloaded, an FAQ answer is copied for a call, or a
// story link is pulled into a proposal — "this collateral got used".
router.post('/:id/use', async (req, res) => {
  try {
    res.json(await contentService.recordContentUsage(req.params.id, req.body.actor));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.use((err, req, res, next) => {
  if (err) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum upload size is ' +
          Math.round(ASSET_MAX_BYTES / 1024 / 1024) +
          'MB — host larger video elsewhere and register it as a link.'
        : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
