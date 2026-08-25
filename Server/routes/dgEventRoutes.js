const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');
const DgEvent = require('../models/DgEvent');

// Flagship annual event — deliberately isolated from /api/events so year-long
// executive planning never mixes with weekly operational forums.

// The stage manifest: which activities and which fields each stage carries.
// The UI renders from this rather than keeping its own copy that could drift.
router.get('/meta', (req, res) => {
  res.json({
    stages: DgEvent.PHASES.map((name, idx) => ({
      name,
      order: idx + 1,
      ...DgEvent.STAGE_SPEC[name],
    })),
    departments: DgEvent.DEPARTMENTS,
    proposalTypes: DgEvent.PROPOSAL_TYPES,
    proposalStatuses: DgEvent.PROPOSAL_STATUSES,
  });
});

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
// --- Stage fields: owner, dates, blocked ---
router.patch('/:id/phases/:phaseId', async (req, res) => {
  try {
    res.json(await bdService.updateDgPhase(req.params.id, req.params.phaseId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- Stage attributes, validated against that stage's declared fields ---
router.patch('/:id/phases/:phaseId/attributes', async (req, res) => {
  try {
    res.json(await bdService.setDgPhaseAttributes(req.params.id, req.params.phaseId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- Stage expenses, which total into the event's budgetSpent ---
router.post('/:id/phases/:phaseId/expenses', async (req, res) => {
  try {
    res.status(201).json(await bdService.addDgPhaseExpense(req.params.id, req.params.phaseId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/phases/:phaseId/expenses/:expenseId', async (req, res) => {
  try {
    res.json(await bdService.deleteDgPhaseExpense(
      req.params.id, req.params.phaseId, req.params.expenseId
    ));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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
