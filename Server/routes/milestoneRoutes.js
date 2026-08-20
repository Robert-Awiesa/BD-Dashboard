const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

router.get('/', async (req, res) => {
  try {
    // `client` scopes to one account's appreciation dates; `scope` separates the
    // team culture board ('team') from client milestones ('client').
    const { milestoneType, active, client, scope } = req.query;
    res.json(await bdService.getAllMilestones({ milestoneType, active, client, scope }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await bdService.createMilestone(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await bdService.updateMilestone(req.params.id, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteMilestone(req.params.id);
    res.json({ message: 'Milestone deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
