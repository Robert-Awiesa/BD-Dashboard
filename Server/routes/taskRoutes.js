const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const Task = require('../models/Task');
const Project = require('../models/Project');

router.get('/meta', (req, res) => {
  res.json({
    statuses: Task.TASK_STATUSES,
    priorities: Task.PRIORITIES,
    projectStatuses: Project.PROJECT_STATUSES,
  });
});

// The one list: standalone tasks plus every borrowed obligation, read through
// to the module that owns it. Declared before /:id so it is not read as an id.
router.get('/my-work', async (req, res) => {
  try {
    res.json(await taskService.getMyWork(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await taskService.getWorkStats(req.query.owner));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Everyone with work assigned anywhere in the workspace, not just here.
router.get('/owners', async (req, res) => {
  try {
    res.json(await taskService.getWorkOwners());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Projects (declared before /:id for the same reason) ---
router.get('/projects', async (req, res) => {
  try {
    res.json(await taskService.getProjects(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/projects', async (req, res) => {
  try {
    res.status(201).json(await taskService.createProject(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    res.json(await taskService.updateProject(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const deleted = await taskService.deleteProject(req.params.id);
    res.json({ message: 'Project deleted; its tasks are now unfiled', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// --- Tasks ---
router.get('/', async (req, res) => {
  try {
    res.json(await taskService.getTasks(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await taskService.getTaskById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await taskService.createTask(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await taskService.updateTask(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await taskService.deleteTask(req.params.id);
    res.json({ message: 'Task deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
