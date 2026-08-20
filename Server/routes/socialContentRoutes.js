const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const { uploadScript, uploadCoverImage } = require('../middleware/upload');

// GET all social content entries (supports filtering by platform or status)
router.get('/', async (req, res) => {
  try {
    const { platform, status } = req.query;
    const entries = await bdService.getAllSocialContent({ platform, status });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST new synced entry (handles scheduling, script, or content archive data)
router.post('/', async (req, res) => {
  try {
    const savedEntry = await bdService.createSocialContent(req.body);
    res.status(201).json(savedEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update an entry
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateSocialContent(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE an entry
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteSocialContent(req.params.id);
    res.json({ message: 'Entry deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// POST a script file (.txt/.doc/.docx) — returns the stored URL + original name
router.post('/upload-script', uploadScript.single('scriptFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.status(201).json({
    scriptFileUrl: `/uploads/scripts/${req.file.filename}`,
    scriptFileName: req.file.originalname,
  });
});

// POST a cover image — returns the stored URL
router.post('/upload-cover', uploadCoverImage.single('coverImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.status(201).json({ coverImage: `/uploads/covers/${req.file.filename}` });
});

// Multer error handler (file type / size rejections)
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.message });
  next();
});

module.exports = router;
