const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// GET all campaigns (supports filtering by status or platform)
router.get('/', async (req, res) => {
  try {
    const { status, platform } = req.query;
    const campaigns = await bdService.getAllCampaigns({ status, platform });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const campaign = await bdService.getCampaignById(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const campaign = await bdService.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await bdService.updateCampaign(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteCampaign(req.params.id);
    res.json({ message: 'Campaign deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.put('/:id/metrics/:platform', async (req, res) => {
  try {
    const campaign = await bdService.saveCampaignPlatformMetrics(
      req.params.id,
      req.params.platform,
      req.body
    );
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id/insights', async (req, res) => {
  try {
    const campaign = await bdService.saveCampaignInsights(req.params.id, req.body);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id/reschedule', async (req, res) => {
  try {
    const campaign = await bdService.rescheduleCampaign(req.params.id, req.body);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
