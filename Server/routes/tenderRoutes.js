const express = require('express');
const router = express.Router();
const tenderService = require('../services/tenderService');
const Tender = require('../models/Tender');
const Eoi = require('../models/Eoi');
const { uploadTender, EOI_MAX_BYTES } = require('../middleware/upload');

// Enum manifest, so the forms cannot drift from the schema.
router.get('/meta', (req, res) => {
  res.json({
    tenderTypes: Tender.TENDER_TYPES,
    tenderStatuses: Tender.TENDER_STATUSES,
    closedStatuses: Tender.CLOSED_STATUSES,
    submittedStatuses: Tender.SUBMITTED_STATUSES,
    sources: Tender.SOURCES,
    sectors: Tender.SECTORS,
    fdpCurrencies: Tender.FDP_CURRENCIES,
    bomOptions: Tender.BOM_OPTIONS,
    implementationCostStates: Tender.IMPLEMENTATION_COST_STATES,
    sourceRequirements: Tender.SOURCE_REQUIREMENTS,
    eoiStatuses: Eoi.EOI_STATUSES,
    decisions: Eoi.DECISIONS,
    closingSoonDays: Tender.CLOSING_SOON_DAYS,
  });
});

// The source image is required at CREATE time, so it uploads on its own and
// the create payload carries the returned URL. That also lets an edit swap the
// clipping without re-posting the whole record.
router.post('/source-image', uploadTender.single('sourceImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.status(201).json({
    url: `/uploads/tenders/${req.file.filename}`,
    fileName: req.file.originalname,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await tenderService.getTenderStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// One list across tenders AND EOIs, soonest first — a deadline does not care
// which tab it lives on.
router.get('/runway', async (req, res) => {
  try {
    res.json(await tenderService.getDeadlineRunway(Number(req.query.withinDays) || 60));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/owners', async (req, res) => {
  try {
    res.json(await tenderService.getTenderOwners());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/authorities', async (req, res) => {
  try {
    res.json(await tenderService.getIssuingAuthorities());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await tenderService.getAllTenders(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await tenderService.getTenderById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// The bid that answered this tender, read through from Proposals rather than
// duplicated here.
router.get('/:id/proposals', async (req, res) => {
  try {
    res.json(await tenderService.getLinkedProposals(req.params.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await tenderService.createTender(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await tenderService.updateTender(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    res.json(await tenderService.setMilestoneDone(
      req.params.id, req.params.milestoneId, req.body.done !== false
    ));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await tenderService.setTenderArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await tenderService.deleteTender(req.params.id);
    res.json({ message: 'Tender deleted', item: deleted });
  } catch (error) {
    // "Archive it first" is a refused precondition, not a missing record.
    const status = error.message === 'Tender not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// Multer rejections surface as 400s rather than the generic 500 handler.
router.use((err, req, res, next) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Maximum upload size is ${Math.round(EOI_MAX_BYTES / 1024 / 1024)}MB.`
      : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
