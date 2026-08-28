const express = require('express');
const router = express.Router();
const Certification = require('../models/Certification');

router.get('/', async (req, res) => {
  try {
    const certs = await Certification.find().sort({ createdAt: -1 });
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const cert = new Certification(req.body);
    const saved = await cert.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Certification.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Certification not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Certification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Certification not found' });
    res.json({ message: 'Certification deleted', item: deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
