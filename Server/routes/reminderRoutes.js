const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const { evaluateReminders } = require('../services/reminderEngine');

// Unified notification feed across campaigns, events, milestones, etc.
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

// Dismiss reminder
router.post('/:id/action', async (req, res) => {
  try {
    res.json(await bdService.actionReminder(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Dynamic Rescheduling workflow
router.post('/:id/reschedule', async (req, res) => {
  try {
    const { newDate, reason, rescheduledBy } = req.body;
    if (!newDate || !reason) {
      return res.status(400).json({ message: 'Both newDate and a mandatory reason for delay are required.' });
    }
    const updated = await bdService.rescheduleReminder(req.params.id, { newDate, reason, rescheduledBy });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Early Completion & Metrics Bypass workflow
router.post('/:id/complete', async (req, res) => {
  try {
    const { completionNotes, deliverables, performanceData, completedBy } = req.body;
    const updated = await bdService.completeReminder(req.params.id, {
      completionNotes,
      deliverables,
      performanceData,
      completedBy,
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
