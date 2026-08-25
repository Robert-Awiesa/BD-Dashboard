const express = require('express');
const router = express.Router();
const tenderService = require('../services/tenderService');
const { uploadEoi, EOI_MAX_BYTES } = require('../middleware/upload');

router.get('/', async (req, res) => {
  try {
    res.json(await tenderService.getAllEois(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await tenderService.getEoiById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await tenderService.createEoi(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await tenderService.updateEoi(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Bid / no-bid. A Pass must carry a reason — that is the whole value of
// recording it, so the same notice is not re-argued next month.
router.patch('/:id/decision', async (req, res) => {
  try {
    res.json(await tenderService.setEoiDecision(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Promote an EOI into a full tender, carrying everything already captured so
// nobody retypes a reference number or a deadline.
router.post('/:id/convert', async (req, res) => {
  try {
    res.status(201).json(await tenderService.convertEoiToTender(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await tenderService.setEoiArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await tenderService.deleteEoi(req.params.id);
    res.json({ message: 'EOI deleted', item: deleted });
  } catch (error) {
    const status = error.message === 'EOI not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// Upload an attachment (image or PDF) and attach it to the record.
// `attachmentType` is fixed to 'upload'; a pasted link is saved via PUT instead.
router.post('/:id/attachment', uploadEoi.single('attachment'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const updated = await tenderService.updateEoi(req.params.id, {
      attachmentType: 'upload',
      attachmentUrl: req.file.url,
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
