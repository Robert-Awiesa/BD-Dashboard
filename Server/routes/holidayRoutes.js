const express = require('express');
const router = express.Router();
const ghanaHolidayService = require('../services/ghanaHolidayService');

// GET /api/holidays
router.get('/', async (req, res) => {
  try {
    const list = await ghanaHolidayService.getHolidays(req.query);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/holidays/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await ghanaHolidayService.getHolidayStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/holidays/sync
router.post('/sync', async (req, res) => {
  try {
    const year = req.body?.year || new Date().getFullYear();
    const synced = await ghanaHolidayService.syncGhanaHolidays(year);
    res.json({ message: `Ghana public holidays for ${year} synced successfully.`, count: synced.length, holidays: synced });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/holidays/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await ghanaHolidayService.updateHoliday(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
