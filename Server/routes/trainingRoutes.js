const express = require('express');
const router = express.Router();
const Training = require('../models/Training');
const TrainingSchedule = require('../models/TrainingSchedule');

const inferCategory = (title = '', organizers = '', type = 'Internal') => {
  const text = `${title} ${organizers}`.toLowerCase();
  if (text.includes('aws')) return 'AWS';
  if (text.includes('sap')) return 'SAP';
  if (text.includes('esri') || text.includes('gis') || text.includes('arcgis')) return 'Esri';
  if (text.includes('opentext')) return 'OpenText';
  if (text.includes('tender') || text.includes('bid') || text.includes('proposal')) return 'BD / Tender';
  if (type === 'Internal') return 'General Tech';
  return 'Other';
};

// GET all trainings
router.get('/', async (req, res) => {
  try {
    const trainings = await Training.find().sort({ createdAt: -1 });
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST new training (automatically syncs to TrainingSchedule calendar)
router.post('/', async (req, res) => {
  try {
    const training = new Training(req.body);
    const saved = await training.save();

    // Auto-create a linked schedule calendar item if start date exists
    if (saved.dateRange?.start) {
      const category = inferCategory(saved.title, saved.externalDetails?.organizers, saved.type);
      const schedule = new TrainingSchedule({
        title: saved.title,
        category,
        targetDate: saved.dateRange.start,
        targetGroup: saved.participants?.length ? saved.participants.join(', ') : (saved.type === 'Internal' ? 'Internal Team' : 'All Staff'),
        note: saved.description || saved.takeaways || '',
        status: 'Logged as Training',
        convertedTrainingId: saved._id,
      });
      await schedule.save();
    }

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update training (syncs schedule if linked)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Training.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Training not found' });

    // Sync linked schedule if it exists
    if (updated.dateRange?.start) {
      const category = inferCategory(updated.title, updated.externalDetails?.organizers, updated.type);
      await TrainingSchedule.findOneAndUpdate(
        { convertedTrainingId: updated._id },
        {
          title: updated.title,
          category,
          targetDate: updated.dateRange.start,
          targetGroup: updated.participants?.length ? updated.participants.join(', ') : 'All Staff',
          note: updated.description || updated.takeaways || '',
          status: 'Logged as Training',
        },
        { upsert: false }
      );
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE training (removes linked schedule)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Training.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Training not found' });

    // Delete linked schedule
    await TrainingSchedule.findOneAndDelete({ convertedTrainingId: deleted._id });

    res.json({ message: 'Training deleted', item: deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
