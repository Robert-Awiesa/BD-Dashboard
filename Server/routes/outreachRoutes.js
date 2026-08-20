const express = require('express');
const router = express.Router();
const outreachService = require('../services/outreachService');
const OutreachCampaign = require('../models/OutreachCampaign');
const OutreachRecipient = require('../models/OutreachRecipient');

router.get('/meta', (req, res) => {
  res.json({
    channels: OutreachCampaign.CHANNELS,
    statuses: OutreachCampaign.STATUSES,
    recipientStatuses: OutreachRecipient.STATUSES,
    smsRecipientStatuses: OutreachRecipient.SMS_STATUSES,
    sourceTypes: OutreachRecipient.SOURCE_TYPES,
    metricsGraceDays: OutreachCampaign.METRICS_GRACE_DAYS,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await outreachService.getStats(req.query.channel));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Declared before /:id so "recipients" is never read as a campaign id.
router.patch('/recipients/:rid', async (req, res) => {
  try {
    res.json(await outreachService.updateRecipient(req.params.rid, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/recipients/:rid', async (req, res) => {
  try {
    const deleted = await outreachService.deleteRecipient(req.params.rid);
    res.json({ message: 'Recipient removed', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// --- Campaigns ---
router.get('/', async (req, res) => {
  try {
    res.json(await outreachService.getCampaigns(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await outreachService.getCampaignById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await outreachService.createCampaign(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await outreachService.updateCampaign(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await outreachService.setCampaignArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await outreachService.deleteCampaign(req.params.id);
    res.json({ message: 'Campaign deleted', item: deleted });
  } catch (error) {
    // "Archive it first" is a refused precondition, not a missing record.
    const status = error.message === 'Campaign not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// --- Recipients ---
router.get('/:id/recipients', async (req, res) => {
  try {
    res.json(await outreachService.getRecipients(req.params.id, req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/recipients', async (req, res) => {
  try {
    res.status(201).json(await outreachService.addRecipient(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Parsed spreadsheet rows. Returns per-row errors and a duplicate count rather
// than one opaque failure for the whole file.
router.post('/:id/recipients/bulk', async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body.rows;
    res.status(201).json(await outreachService.bulkAddRecipients(req.params.id, rows));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/recipients/import', async (req, res) => {
  try {
    res.status(201).json(await outreachService.importFromWorkspace(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- Batches ---
router.post('/:id/batches', async (req, res) => {
  try {
    res.status(201).json(await outreachService.logBatch(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id/batches/:batchId/metrics', async (req, res) => {
  try {
    res.json(await outreachService.saveBatchMetrics(req.params.id, req.params.batchId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/batches/:batchId', async (req, res) => {
  try {
    res.json(await outreachService.deleteBatch(req.params.id, req.params.batchId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
