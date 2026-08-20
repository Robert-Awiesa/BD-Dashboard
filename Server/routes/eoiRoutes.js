const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const { uploadEoi, EOI_MAX_BYTES } = require('../middleware/upload');

// GET all EOIs
router.get('/', async (req, res) => {
  try {
    res.json(await bdService.getAllEois());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a new EOI (JSON only — no attachment yet)
router.post('/', async (req, res) => {
  try {
    const saved = await bdService.createEoi(req.body);
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update an EOI
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateEoi(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE an EOI
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteEoi(req.params.id);
    res.json({ message: 'EOI deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Upload an EOI attachment (image or PDF) and attach it to the record.
// `attachmentType` is fixed to 'upload'; a pasted link is saved via PUT instead.
router.post('/:id/attachment', uploadEoi.single('attachment'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const updated = await bdService.updateEoi(req.params.id, {
      attachmentType: 'upload',
      attachmentUrl: `/uploads/eois/${req.file.filename}`,
      attachmentFileName: req.file.originalname,
    });
    res.status(201).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Multer rejections surface as 400s here rather than the generic 500 handler.
router.use((err, req, res, next) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Maximum upload size is ${Math.round(EOI_MAX_BYTES / 1024 / 1024)}MB — use a link instead.`
      : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
