// ============================================
// Client Relations services.
// The post-sale half of the pipeline: who our clients are, when we last spoke
// to them, what we promised, and whether they are happy.
// ============================================

const Client = require('../models/Client');
const Interaction = require('../models/Interaction');
const Pipeline = require('../models/Pipeline');
const Milestone = require('../models/Milestone');
const Reminder = require('../models/Reminder');

const normaliseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

const CLIENT_SORTS = {
  name: { name: 1 },
  recent: { createdAt: -1 },
  contact: { lastContactAt: 1 }, // longest-neglected first
  renewal: { renewalDate: 1 },
  value: { contractValue: -1 },
};

const withLinks = (query) =>
  query
    .populate('sourcePipelineItem', 'name type value')
    .populate('linkedCaseStudy', 'title contentType quantifiableResults');

// ====================
// QUERIES
// ====================

exports.getAllClients = async (filters = {}) => {
  const { search, tier, status, accountOwner, sector, health, includeArchived, sort = 'name' } = filters;

  const query = {};
  if (tier) query.tier = tier;
  if (status) query.status = status;
  if (accountOwner) query.accountOwner = accountOwner;
  if (sector) query.sector = sector;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [
      { name: rx }, { sector: rx }, { accountOwner: rx },
      { tags: rx }, { notes: rx }, { 'contacts.name': rx }, { 'contacts.email': rx },
    ];
  }

  const clients = await withLinks(Client.find(query).sort(CLIENT_SORTS[sort] || CLIENT_SORTS.name));

  // healthStatus is a virtual, so this filter is applied after the query.
  if (health) return clients.filter((c) => c.healthStatus === health);
  return clients;
};

exports.getClientById = async (id) => {
  const client = await withLinks(Client.findById(id));
  if (!client) throw new Error('Client not found');
  return client;
};

exports.getClientOwners = async () => {
  const owners = await Client.distinct('accountOwner', { archived: { $ne: true } });
  return owners.filter(Boolean).sort((a, b) => a.localeCompare(b));
};

exports.getClientSectors = async () => {
  const sectors = await Client.distinct('sector', { archived: { $ne: true } });
  return sectors.filter(Boolean).sort((a, b) => a.localeCompare(b));
};

// ====================
// CREATE / UPDATE
// ====================

const buildPayload = (data) => ({
  name: (data.name || '').trim(),
  sector: data.sector || '',
  tier: data.tier || 'Standard',
  status: data.status || 'Active',
  accountOwner: data.accountOwner || '',
  contacts: Array.isArray(data.contacts) ? data.contacts : [],
  contactCadenceDays: data.contactCadenceDays || undefined,
  relationshipStart: data.relationshipStart || undefined,
  contractValue: data.contractValue || 0,
  renewalDate: data.renewalDate || undefined,
  sourcePipelineItem: data.sourcePipelineItem || undefined,
  linkedCaseStudy: data.linkedCaseStudy || undefined,
  notes: data.notes || '',
  tags: normaliseTags(data.tags),
});

exports.createClient = async (data) => {
  const payload = buildPayload(data);
  if (!payload.name) throw new Error('A client name is required');
  const created = await Client.create(payload);
  return withLinks(Client.findById(created._id));
};

exports.updateClient = async (id, data) => {
  const { _id, commitments, surveys, lastContactAt, ...updates } = data;
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);
  for (const field of ['renewalDate', 'relationshipStart', 'sourcePipelineItem', 'linkedCaseStudy']) {
    if (updates[field] === '') updates[field] = null;
  }
  if (updates.contactCadenceDays === '' || updates.contactCadenceDays === null) {
    updates.contactCadenceDays = undefined;
  }

  const updated = await withLinks(
    Client.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true })
  );
  if (!updated) throw new Error('Client not found');
  return updated;
};

exports.setClientArchived = async (id, archived) => {
  const client = await Client.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!client) throw new Error('Client not found');
  return client;
};

// Same rule as the other modules: the workspace is open to everyone, so archive
// is the route out and a hard delete is only reachable once archived.
exports.deleteClient = async (id) => {
  const client = await Client.findById(id);
  if (!client) throw new Error('Client not found');
  if (!client.archived) {
    throw new Error('Archive this client before deleting — that keeps the relationship history recoverable until someone deliberately discards it.');
  }
  // Everything that pointed at this client goes with it — otherwise the
  // reminder feed keeps nagging about an account nobody can open, and the
  // appreciation dates linger on the milestone board with no owner.
  await Interaction.deleteMany({ client: id });
  await Milestone.deleteMany({ client: id });
  await Reminder.deleteMany({ sourceType: 'Client', sourceId: id });
  await client.deleteOne();
  return client;
};

// A won deal should become a relationship rather than going cold in the
// pipeline. Mirrors the existing convertColdCallToProspectingLead idiom.
exports.convertPipelineItemToClient = async (pipelineId, overrides = {}) => {
  const item = await Pipeline.findById(pipelineId);
  if (!item) throw new Error('Pipeline item not found');

  const existing = await Client.findOne({ sourcePipelineItem: pipelineId });
  if (existing) throw new Error(`"${item.name}" has already been converted to a client.`);

  const created = await Client.create(
    buildPayload({
      name: item.name,
      sector: item.type || '',
      accountOwner: overrides.accountOwner || '',
      contractValue: item.value || 0,
      relationshipStart: new Date(),
      notes: item.notes || '',
      contacts: item.contact ? [{ name: item.contact, isPrimary: true }] : [],
      sourcePipelineItem: item._id,
      ...overrides,
    })
  );
  return withLinks(Client.findById(created._id));
};

// ====================
// INTERACTIONS
// ====================

// Keeps the denormalised lastContact* fields on Client honest. Called after
// every write to the interaction log, including deletes, where the previous
// interaction has to be promoted back to "latest".
const refreshLastContact = async (clientId) => {
  const latest = await Interaction.findOne({
    client: clientId,
    // A visit booked for next Tuesday is not contact that has happened. Without
    // these guards a planned visit would push lastContactAt into the future,
    // making daysSinceLastContact negative and silently marking every neglected
    // account healthy. `$nin` also matches documents with no visitStatus at all,
    // so ordinary calls and emails still count.
    occurredAt: { $lte: new Date() },
    visitStatus: { $nin: ['Planned', 'Cancelled'] },
  }).sort({ occurredAt: -1 });
  await Client.findByIdAndUpdate(clientId, {
    lastContactAt: latest ? latest.occurredAt : null,
    lastContactBy: latest ? latest.loggedBy : '',
    lastContactType: latest ? latest.type : '',
  });
};

exports.logInteraction = async (data) => {
  if (!data.client) throw new Error('Pick which client this was with');
  if (!data.summary || !data.summary.trim()) throw new Error('Add a one-line summary of what happened');
  if (!data.loggedBy) throw new Error('An active team member is required to log an interaction');

  const client = await Client.findById(data.client);
  if (!client) throw new Error('Client not found');

  const interaction = await Interaction.create({
    client: data.client,
    type: data.type || 'Call',
    summary: data.summary.trim(),
    detail: data.detail || '',
    occurredAt: data.occurredAt || new Date(),
    loggedBy: data.loggedBy,
    contactName: data.contactName || '',
    sentiment: data.sentiment || 'Neutral',
    followUpNeeded: Boolean(data.followUpNeeded),
    linkedEvent: data.linkedEvent || undefined,
  });

  // Logging a call and promising to follow up is one action for the user, so
  // the commitment is created here rather than in a second form.
  if (data.commitmentDescription && data.commitmentDescription.trim()) {
    client.commitments.push({
      description: data.commitmentDescription.trim(),
      owner: data.commitmentOwner || data.loggedBy,
      dueDate: data.commitmentDue || undefined,
      createdBy: data.loggedBy,
    });
    await client.save();
  }

  await refreshLastContact(data.client);
  return Interaction.findById(interaction._id).populate('client', 'name tier');
};

exports.getInteractions = async (filters = {}) => {
  const { client, type, sentiment, limit = 50 } = filters;
  const query = {};
  if (client) query.client = client;
  if (type) query.type = type;
  if (sentiment) query.sentiment = sentiment;

  return Interaction.find(query)
    .sort({ occurredAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .populate('client', 'name tier sector');
};

exports.updateInteraction = async (id, data) => {
  const { _id, client, ...updates } = data;
  const updated = await Interaction.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new Error('Interaction not found');
  await refreshLastContact(updated.client);
  return updated.populate('client', 'name tier');
};

exports.deleteInteraction = async (id) => {
  const deleted = await Interaction.findByIdAndDelete(id);
  if (!deleted) throw new Error('Interaction not found');
  await refreshLastContact(deleted.client);
  return deleted;
};

// ====================
// COMMITMENTS
// ====================

exports.addCommitment = async (clientId, data) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');
  if (!data.description || !data.description.trim()) throw new Error('Describe what was promised');
  client.commitments.push({
    description: data.description.trim(),
    owner: data.owner || '',
    dueDate: data.dueDate || undefined,
    createdBy: data.createdBy || '',
  });
  await client.save();
  return client;
};

exports.setCommitmentDone = async (clientId, commitmentId, completed) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');
  const commitment = client.commitments.id(commitmentId);
  if (!commitment) throw new Error('Commitment not found');
  commitment.completed = completed;
  commitment.completedAt = completed ? new Date() : null;
  await client.save();
  return client;
};

exports.deleteCommitment = async (clientId, commitmentId) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');
  const commitment = client.commitments.id(commitmentId);
  if (!commitment) throw new Error('Commitment not found');
  commitment.deleteOne();
  await client.save();
  return client;
};

// ====================
// SATISFACTION
// ====================

exports.recordSurvey = async (clientId, data) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');
  const score = Number(data.score);
  if (!score || score < 1 || score > 5) throw new Error('Score must be between 1 and 5');
  client.surveys.push({
    score,
    comment: data.comment || '',
    respondent: data.respondent || '',
    collectedBy: data.collectedBy || '',
    collectedAt: data.collectedAt || new Date(),
  });
  await client.save();
  return client;
};

exports.deleteSurvey = async (clientId, surveyId) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');
  const survey = client.surveys.id(surveyId);
  if (!survey) throw new Error('Survey response not found');
  survey.deleteOne();
  await client.save();
  return client;
};

// ====================
// PORTFOLIO DASHBOARD
// ====================

const SEVERITY_RANK = { Critical: 0, 'At Risk': 1, Watch: 2 };

exports.getPortfolioStats = async () => {
  const clients = await Client.find({ archived: { $ne: true } });

  const byHealth = { Healthy: 0, Watch: 0, 'At Risk': 0, Critical: 0, Dormant: 0, Churned: 0 };
  const needsAttention = [];
  let satisfactionSum = 0;
  let satisfactionCount = 0;
  let overdueCommitments = 0;
  let renewalsDue = 0;

  for (const client of clients) {
    byHealth[client.healthStatus] = (byHealth[client.healthStatus] || 0) + 1;

    const score = client.satisfactionScore;
    if (score !== null) {
      satisfactionSum += score;
      satisfactionCount += 1;
    }

    overdueCommitments += client.overdueCommitments.length;
    const toRenewal = client.daysToRenewal;
    if (toRenewal !== null && toRenewal >= 0 && toRenewal <= Client.RENEWAL_HORIZON_DAYS) renewalsDue += 1;

    const reasons = client.attentionReasons;
    if (reasons.length > 0) {
      needsAttention.push({
        _id: client._id,
        name: client.name,
        tier: client.tier,
        accountOwner: client.accountOwner,
        healthStatus: client.healthStatus,
        daysSinceLastContact: client.daysSinceLastContact,
        reasons,
      });
    }
  }

  // Most urgent first, then longest-neglected — the order a rep should work.
  needsAttention.sort((a, b) => {
    const rank = SEVERITY_RANK[a.healthStatus] - SEVERITY_RANK[b.healthStatus];
    if (rank !== 0) return rank;
    return (b.daysSinceLastContact ?? 9999) - (a.daysSinceLastContact ?? 9999);
  });

  const activeClients = clients.filter((c) => c.status === 'Active' || c.status === 'Onboarding');

  return {
    totals: {
      clients: clients.length,
      active: activeClients.length,
      needsAttention: needsAttention.length,
      renewalsDue,
      overdueCommitments,
      avgSatisfaction: satisfactionCount
        ? Math.round((satisfactionSum / satisfactionCount) * 10) / 10
        : null,
      portfolioValue: clients.reduce((sum, c) => sum + (c.contractValue || 0), 0),
    },
    byHealth,
    needsAttention: needsAttention.slice(0, 12),
    // Renewal runway, soonest first.
    upcomingRenewals: clients
      .filter((c) => {
        const d = c.daysToRenewal;
        return d !== null && d >= 0 && d <= Client.RENEWAL_HORIZON_DAYS;
      })
      .sort((a, b) => a.daysToRenewal - b.daysToRenewal)
      .slice(0, 8)
      .map((c) => ({
        _id: c._id, name: c.name, renewalDate: c.renewalDate,
        daysToRenewal: c.daysToRenewal, contractValue: c.contractValue,
        accountOwner: c.accountOwner,
      })),
  };
};
