const express = require('express');
const router = express.Router();
const bdService = require('../services/bdService');

router.get('/', async (req, res) => {
  try {
    const { eventType, cancelled } = req.query;
    const events = await bdService.getAllEvents({ eventType, cancelled });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await bdService.getEventById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await bdService.createEvent(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await bdService.updateEvent(req.params.id, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await bdService.deleteEvent(req.params.id);
    res.json({ message: 'Event deleted', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Prep checklist — single-task toggle rather than a whole-array overwrite
router.patch('/:id/tasks/:taskId', async (req, res) => {
  try {
    res.json(await bdService.toggleEventTask(req.params.id, req.params.taskId, req.body.completed));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// RSVP / attendance
router.patch('/:id/attendees/:attendeeId', async (req, res) => {
  try {
    res.json(await bdService.updateEventAttendee(req.params.id, req.params.attendeeId, req.body));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Post-event performance matrix
router.put('/:id/metrics', async (req, res) => {
  try {
    res.json(await bdService.saveEventMetrics(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Push a session lead into the prospecting pipeline
router.post('/:id/convert-lead', async (req, res) => {
  try {
    res.status(201).json(await bdService.convertEventLeadToProspect(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
