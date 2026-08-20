const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// GET all tenders
router.get('/', async (req, res) => {
  try {
    const tenders = await bdService.getAllTenders();
    res.json(tenders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a new tender
router.post('/', async (req, res) => {
  try {
    const savedTender = await bdService.createTender(req.body);
    res.status(201).json(savedTender);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update a tender
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateTender(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE a tender
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteTender(req.params.id);
    res.json({ message: 'Tender deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;