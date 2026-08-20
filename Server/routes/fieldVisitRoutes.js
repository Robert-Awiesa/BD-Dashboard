const express = require('express');
const router = express.Router();
const fieldVisitService = require('../services/fieldVisitService');
const Interaction = require('../models/Interaction');
const { uploadVisitPhoto, VISIT_PHOTO_MAX_BYTES } = require('../middleware/upload');

router.get('/meta', (req, res) => {
  res.json({
    visitStatuses: Interaction.VISIT_STATUSES,
    sentiments: Interaction.SENTIMENTS,
    maxPhotoBytes: VISIT_PHOTO_MAX_BYTES,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await fieldVisitService.getVisitStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Store a photo, then attach it to the visit.
router.post('/:id/photos', uploadVisitPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });
    const updated = await fieldVisitService.addVisitPhoto(req.params.id, {
      url: '/uploads/visits/' + req.file.filename,
      caption: req.body.caption || '',
    });
    res.status(201).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    res.json(await fieldVisitService.deleteVisitPhoto(req.params.id, req.params.photoId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await fieldVisitService.getVisits(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await fieldVisitService.getVisitById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await fieldVisitService.createVisit(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await fieldVisitService.updateVisit(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Plan -> done, filing the report in the same step.
router.post('/:id/complete', async (req, res) => {
  try {
    res.json(await fieldVisitService.completeVisit(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await fieldVisitService.deleteVisit(req.params.id);
    res.json({ message: 'Visit removed', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.use((err, req, res, next) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Photo is too large. Maximum size is ${Math.round(VISIT_PHOTO_MAX_BYTES / 1024 / 1024)}MB.`
      : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
