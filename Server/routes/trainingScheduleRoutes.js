const express = require('express');
const router = express.Router();
const trainingService = require('../services/trainingService');

// Before /:id, or "stats" is read as an id.
router.get('/stats', async (req, res) => {
  try {
    res.json(await trainingService.getScheduleStats(req.query.year));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await trainingService.getSchedules(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await trainingService.createSchedule(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await trainingService.updateSchedule(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await trainingService.setScheduleArchived(req.params.id, req.body.archived));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await trainingService.deleteSchedule(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Turn a planned roadmap item into the record of a session that happened.
router.post('/:id/convert', async (req, res) => {
  try {
    res.status(201).json(await trainingService.convertScheduleToTraining(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
