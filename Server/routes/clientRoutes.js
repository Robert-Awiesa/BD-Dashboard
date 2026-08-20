const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const Client = require('../models/Client');
const Interaction = require('../models/Interaction');

// Enum/default manifest so the forms never drift from the schema.
router.get('/meta', (req, res) => {
  res.json({
    tiers: Client.TIERS,
    statuses: Client.CLIENT_STATUSES,
    defaultCadenceDays: Client.DEFAULT_CADENCE_DAYS,
    renewalHorizonDays: Client.RENEWAL_HORIZON_DAYS,
    interactionTypes: Interaction.INTERACTION_TYPES,
    sentiments: Interaction.SENTIMENTS,
  });
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await clientService.getPortfolioStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/owners', async (req, res) => {
  try {
    res.json(await clientService.getClientOwners());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/sectors', async (req, res) => {
  try {
    res.json(await clientService.getClientSectors());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Team activity feed — every client update, newest first, across the portfolio.
// Declared before /:id so "interactions" is not read as a client id.
router.get('/interactions', async (req, res) => {
  try {
    res.json(await clientService.getInteractions(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/interactions', async (req, res) => {
  try {
    res.status(201).json(await clientService.logInteraction(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/interactions/:id', async (req, res) => {
  try {
    res.json(await clientService.updateInteraction(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/interactions/:id', async (req, res) => {
  try {
    const deleted = await clientService.deleteInteraction(req.params.id);
    res.json({ message: 'Interaction removed', item: deleted });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Promote a won deal into an ongoing relationship.
router.post('/convert/:pipelineId', async (req, res) => {
  try {
    res.status(201).json(await clientService.convertPipelineItemToClient(req.params.pipelineId, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await clientService.getAllClients(req.query));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await clientService.getClientById(req.params.id));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await clientService.createClient(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await clientService.updateClient(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    res.json(await clientService.setClientArchived(req.params.id, req.body.archived !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await clientService.deleteClient(req.params.id);
    res.json({ message: 'Client deleted', item: deleted });
  } catch (error) {
    const status = error.message === 'Client not found' ? 404 : 409;
    res.status(status).json({ message: error.message });
  }
});

// --- Commitments ---
router.post('/:id/commitments', async (req, res) => {
  try {
    res.status(201).json(await clientService.addCommitment(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/commitments/:commitmentId', async (req, res) => {
  try {
    res.json(await clientService.setCommitmentDone(req.params.id, req.params.commitmentId, req.body.completed !== false));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

router.delete('/:id/commitments/:commitmentId', async (req, res) => {
  try {
    res.json(await clientService.deleteCommitment(req.params.id, req.params.commitmentId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// --- Satisfaction (Sati-Survey) ---
router.post('/:id/surveys', async (req, res) => {
  try {
    res.status(201).json(await clientService.recordSurvey(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/surveys/:surveyId', async (req, res) => {
  try {
    res.json(await clientService.deleteSurvey(req.params.id, req.params.surveyId));
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
