const express = require('express');
const router = express.Router();
const trainingService = require('../services/trainingService');

router.get('/', async (req, res) => {
  try {
    res.json(await trainingService.getTrainings(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await trainingService.createTraining(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await trainingService.updateTraining(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await trainingService.setTrainingArchived(req.params.id, req.body.archived));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await trainingService.deleteTraining(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
