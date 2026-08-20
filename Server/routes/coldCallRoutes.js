const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// GET all cold calls
router.get('/', async (req, res) => {
  try {
    const calls = await bdService.getAllColdCalls();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST log a new cold call
router.post('/', async (req, res) => {
  try {
    const savedCall = await bdService.createColdCall(req.body);
    res.status(201).json(savedCall);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update a cold call (e.g. log a follow-up)
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateColdCall(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE a cold call
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteColdCall(req.params.id);
    res.json({ message: 'Cold call deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// POST convert a cold call into a Prospecting Lead
router.post('/:id/convert', async (req, res) => {
  try {
    const result = await bdService.convertColdCallToProspectingLead(req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
