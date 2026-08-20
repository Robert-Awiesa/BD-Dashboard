const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const { evaluateReminders } = require('../services/reminderEngine');

// Unified notification feed across campaigns, events and milestones.
router.get('/', async (req, res) => {
  try {
    res.json(await bdService.getOpenReminders({ sourceType: req.query.sourceType }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manual sweep, in addition to the daily cron
router.post('/evaluate', async (req, res) => {
  try {
    const created = await evaluateReminders();
    res.json({ evaluated: created.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/action', async (req, res) => {
  try {
    res.json(await bdService.actionReminder(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
