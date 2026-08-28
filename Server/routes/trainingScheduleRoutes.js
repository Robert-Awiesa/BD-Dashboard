const express = require('express');
const router = express.Router();
const TrainingSchedule = require('../models/TrainingSchedule');
const Training = require('../models/Training');

// GET /api/training-schedules/stats
router.get('/stats', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const schedules = await TrainingSchedule.find({ targetYear: year });
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    
    const totalScheduled = schedules.length;
    const dueThisMonth = schedules.filter((s) => s.targetMonth === currentMonth).length;
    
    const upcomingCount = schedules.filter((s) => {
      if (!s.targetDate) return false;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(s.targetDate);
      return target >= today;
    }).length;

    res.json({
      year,
      totalScheduled,
      dueThisMonth,
      upcomingCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/training-schedules
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.year) query.targetYear = Number(req.query.year);
    if (req.query.month) query.targetMonth = Number(req.query.month);
    if (req.query.category && req.query.category !== 'All') query.category = req.query.category;

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [
        { title: regex },
        { targetGroup: regex },
        { note: regex },
        { category: regex },
      ];
    }

    const schedules = await TrainingSchedule.find(query)
      .sort({ targetDate: 1 })
      .populate('convertedTrainingId');

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/training-schedules
router.post('/', async (req, res) => {
  try {
    const schedule = new TrainingSchedule(req.body);
    const saved = await schedule.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/training-schedules/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await TrainingSchedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Training awareness item not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/training-schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await TrainingSchedule.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Training awareness item not found' });
    res.json({ message: 'Item deleted', item: deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/training-schedules/:id/convert (Convert lightweight schedule item into formal Training record)
router.post('/:id/convert', async (req, res) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule item not found' });

    const trainingData = {
      title: req.body.title || schedule.title,
      type: req.body.type || 'Internal',
      dateRange: {
        start: req.body.dateRange?.start || schedule.targetDate,
        end: req.body.dateRange?.end || schedule.targetDate,
      },
      participants: req.body.participants || [],
      facilitator: req.body.facilitator || '',
      description: req.body.description || schedule.note || '',
      takeaways: req.body.takeaways || '',
      progress: req.body.progress || 'Completed',
      externalDetails: {
        organizers: req.body.externalDetails?.organizers || schedule.category || '',
        country: req.body.externalDetails?.country || 'Online',
        modality: req.body.externalDetails?.modality || 'Online',
        cost: req.body.externalDetails?.cost || 'Free',
      },
    };

    const newTraining = new Training(trainingData);
    const savedTraining = await newTraining.save();

    schedule.status = 'Logged as Training';
    schedule.convertedTrainingId = savedTraining._id;
    await schedule.save();

    res.status(201).json({
      message: 'Logged as formal training session',
      training: savedTraining,
      schedule,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
