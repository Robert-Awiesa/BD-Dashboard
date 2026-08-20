const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

// Flagship annual event — deliberately isolated from /api/events so year-long
// executive planning never mixes with weekly operational forums.

router.get('/', async (req, res) => {
  try {
    res.json(await bdService.getAllDgEvents());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await bdService.getDgEventById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await bdService.createDgEvent(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await bdService.updateDgEvent(req.params.id, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteDgEvent(req.params.id);
    res.json({ message: 'DG event deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Departmental task streams within a phase
router.post('/:id/phases/:phaseId/tasks', async (req, res) => {
  try {
    res.status(201).json(await bdService.addDgPhaseTask(req.params.id, req.params.phaseId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/phases/:phaseId/tasks/:taskId', async (req, res) => {
  try {
    res.json(await bdService.updateDgPhaseTask(req.params.id, req.params.phaseId, req.params.taskId, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id/phases/:phaseId/tasks/:taskId', async (req, res) => {
  try {
    res.json(await bdService.deleteDgPhaseTask(req.params.id, req.params.phaseId, req.params.taskId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Team idea / budget submissions and executive review
router.post('/:id/proposals', async (req, res) => {
  try {
    res.status(201).json(await bdService.submitDgProposal(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/proposals/:proposalId', async (req, res) => {
  try {
    res.json(await bdService.reviewDgProposal(req.params.id, req.params.proposalId, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
