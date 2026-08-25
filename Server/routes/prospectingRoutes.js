const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// GET all prospecting leads
router.get('/', async (req, res) => {
  try {
    const leads = await bdService.getAllProspectingLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST single manual entry lead
router.post('/', async (req, res) => {
  try {
    const savedLead = await bdService.createProspectingLead(req.body);
    res.status(201).json(savedLead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST bulk upload leads from an Excel parse.
// Accepts a bare array or { leads: [...] }, because both shapes were already
// being sent and the mismatch produced "must be a non-empty array" on a file
// that was perfectly fine.
router.post('/bulk', async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body?.leads || req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'Request body must be a non-empty array of leads' });
    }
    // { imported, skipped, errors, leads } — the same shape the outreach
    // importer returns, so the UI can report both the same way.
    res.status(201).json(await bdService.bulkCreateProspectingLeads(rows));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update a prospecting lead
router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateProspectingLead(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// DELETE a prospecting lead
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteProspectingLead(req.params.id);
    res.json({ message: 'Prospecting lead deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
