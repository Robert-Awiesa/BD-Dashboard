const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const Milestone = require('../models/Milestone');

// The roster is the union of two sources, so neither has to be kept in step
// with the other by hand:
//   - people registered as Team Member milestones (they have a department,
//     a role, a birthday and a work anniversary)
//   - every name that has ever been set in the header picker
router.get('/', async (req, res) => {
  try {
    const [registered, everSet] = await Promise.all([
      Milestone.find({ milestoneType: 'Team Member', active: true })
        .select('participantName departmentOrCompany role'),
      TeamMember.find().select('name'),
    ]);

    const byKey = new Map();
    for (const m of registered) {
      const name = (m.participantName || '').trim();
      if (!name) continue;
      byKey.set(name.toLowerCase(), {
        name,
        department: m.departmentOrCompany || '',
        role: m.role || '',
        registered: true,
      });
    }
    for (const t of everSet) {
      const name = (t.name || '').trim();
      if (!name) continue;
      const k = name.toLowerCase();
      // A registered person already carries more detail — do not overwrite it.
      if (!byKey.has(k)) byKey.set(k, { name, department: '', role: '', registered: false });
    }

    res.json([...byKey.values()].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Idempotent: setting a name that is already on the roster is a no-op rather
// than an error, because the picker calls this every time somebody types one.
router.post('/', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'A name is required' });

    const key = name.toLowerCase();
    const existing = await TeamMember.findOne({ key });
    if (existing) return res.status(200).json(existing);

    res.status(201).json(await TeamMember.create({ name }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
