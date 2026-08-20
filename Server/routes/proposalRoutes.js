const express = require('express');
const router = express.Router();
const proposalService = require('../services/proposalService');
const Proposal = require('../models/Proposal');

router.get('/meta', (req, res) => {
  res.json({
    origins: Proposal.ORIGINS,
    stages: Proposal.STAGES,
    closedStages: Proposal.CLOSED_STAGES,
    lossReasons: Proposal.LOSS_REASONS,
    stageProbability: Proposal.STAGE_PROBABILITY,
    coldAfterDays: Proposal.COLD_AFTER_DAYS,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await proposalService.getProposalStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/owners', async (req, res) => {
  try {
    res.json(await proposalService.getProposalOwners());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/sectors', async (req, res) => {
  try {
    res.json(await proposalService.getProposalSectors());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await proposalService.getProposals(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await proposalService.getProposalById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await proposalService.createProposal(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await proposalService.updateProposal(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Stage moves are the commonest action and carry the outcome rules.
router.patch('/:id/stage', async (req, res) => {
  try {
    res.json(await proposalService.setStage(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await proposalService.setProposalArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await proposalService.deleteProposal(req.params.id);
    res.json({ message: 'Proposal deleted', item: deleted });
  } catch (error) {
    const status = error.message === 'Proposal not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// --- Checklist ---
router.post('/:id/checklist', async (req, res) => {
  try {
    res.status(201).json(await proposalService.addChecklistItem(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/checklist/:itemId', async (req, res) => {
  try {
    res.json(await proposalService.setChecklistItemDone(req.params.id, req.params.itemId, req.body.completed !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  try {
    res.json(await proposalService.deleteChecklistItem(req.params.id, req.params.itemId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// --- Follow-ups (logging one resets the silence clock) ---
router.post('/:id/follow-ups', async (req, res) => {
  try {
    res.status(201).json(await proposalService.addFollowUp(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/follow-ups/:followUpId', async (req, res) => {
  try {
    res.json(await proposalService.deleteFollowUp(req.params.id, req.params.followUpId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
