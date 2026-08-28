const express = require('express');
const router = express.Router();
const toolService = require('../services/toolService');
const Tool = require('../models/Tool');

router.get('/categories', (req, res) => res.json(Tool.CATEGORIES));

router.get('/', async (req, res) => {
  try {
    res.json(await toolService.getTools(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await toolService.createTool(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// One-time migration of a browser's local launcher onto the shared list.
router.post('/import', async (req, res) => {
  try {
    const { tools, addedBy } = req.body || {};
    res.json(await toolService.importTools(tools, addedBy));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await toolService.updateTool(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await toolService.setToolArchived(req.params.id, req.body.archived));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await toolService.deleteTool(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
