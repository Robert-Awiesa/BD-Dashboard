const express = require('express');
const router = express.Router();
const partnerService = require('../services/partnerService');

router.get('/owners', async (req, res) => {
  try {
    res.json(await partnerService.getPartnerOwners());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await partnerService.getPartners(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await partnerService.getPartnerById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await partnerService.createPartner(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await partnerService.updatePartner(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await partnerService.setPartnerArchived(req.params.id, req.body?.archived));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await partnerService.deletePartner(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
