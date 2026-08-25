const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const { uploadMedia, MEDIA_MAX_BYTES } = require('../middleware/upload');

// Flattened archive across events + milestones
router.get('/', async (req, res) => {
  try {
    res.json(await bdService.getMediaArchive());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload a photo or audio file, then attach it to its owner record.
router.post('/upload/:ownerType/:ownerId', uploadMedia.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Video uploads are allowed now, so "not an image" no longer means audio.
    // Match on extension too: uploads can arrive as application/octet-stream.
    const ext = (req.file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const isVideo = req.file.mimetype.startsWith('video/')
      || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext);
    const kind = req.file.mimetype.startsWith('image/')
      ? 'Photo'
      : isVideo ? 'Video' : 'Audio';
    const owner = await bdService.addMediaItem(req.params.ownerType, req.params.ownerId, {
      url: req.file.url,
      label: req.body.label || req.file.originalname,
      kind,
    });
    res.status(201).json(owner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Attach an external link (recorded video on SharePoint/YouTube, documents, etc.)
router.post('/link/:ownerType/:ownerId', async (req, res) => {
  try {
    res.status(201).json(await bdService.addMediaItem(req.params.ownerType, req.params.ownerId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:ownerType/:ownerId/:mediaId', async (req, res) => {
  try {
    const owner = await bdService.deleteMediaItem(req.params.ownerType, req.params.ownerId, req.params.mediaId);
    res.json({ message: 'Media removed', item: owner });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Multer rejections (oversize file, video upload attempt) surface as 400s here
// rather than falling through to the generic 500 handler.
router.use((err, req, res, next) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Maximum upload size is ${Math.round(MEDIA_MAX_BYTES / 1024 / 1024)}MB — use a link for larger recordings.`
      : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
