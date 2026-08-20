const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// GET all pipeline items
router.get('/', async (req, res) => {
  try {
    const items = await bdService.getAllPipeline();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a new pipeline item
router.post('/', async (req, res) => {
  try {
    const savedItem = await bdService.createPipeline(req.body);
    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update a pipeline item
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updatePipeline(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE a pipeline item
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deletePipeline(req.params.id);
    res.json({ message: 'Pipeline item deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;