// ============================================
// Field Visits.
// A visit-centric view over the Interaction collection rather than a separate
// store — a site visit *is* a client touch, so keeping it in one place means the
// client timeline stays the complete record instead of half of it.
// Everything here narrows to `type: 'Site Visit'`.
// ============================================

const Interaction = require('../models/Interaction');
const Client = require('../models/Client');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const asList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
};

const VISIT_QUERY = { type: 'Site Visit' };

const withClient = (query) => query.populate('client', 'name tier sector accountOwner');

// Keeps Client.lastContact* honest after any visit write. Mirrors the guard in
// clientService: planned and cancelled visits are not contact that happened.
const refreshClientContact = async (clientId) => {
  if (!clientId) return;
  const latest = await Interaction.findOne({
    client: clientId,
    occurredAt: { $lte: new Date() },
    visitStatus: { $nin: ['Planned', 'Cancelled'] },
  }).sort({ occurredAt: -1 });
  await Client.findByIdAndUpdate(clientId, {
    lastContactAt: latest ? latest.occurredAt : null,
    lastContactBy: latest ? latest.loggedBy : '',
    lastContactType: latest ? latest.type : '',
  });
};

// ====================
// QUERIES
// ====================

exports.getVisits = async (filters = {}) => {
  const { client, status, visitType, loggedBy, search, from, to, awaitingReport, limit = 100 } = filters;

  const query = { ...VISIT_QUERY };
  if (client) query.client = client;
  if (status) query.visitStatus = status;
  if (visitType) query.visitType = visitType;
  if (loggedBy) query.loggedBy = loggedBy;

  if (from || to) {
    query.occurredAt = {};
    if (from) query.occurredAt.$gte = new Date(from);
    if (to) query.occurredAt.$lte = new Date(to);
  }

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [
      { summary: rx }, { locationName: rx }, { address: rx }, { purpose: rx },
      { observations: rx }, { detail: rx }, { loggedBy: rx },
      { teamAttendees: rx }, { clientAttendees: rx }, { contactName: rx },
      { 'discoveryDetails.clientRequest': rx }, { 'discoveryDetails.summary': rx },
    ];
  }

  const visits = await withClient(
    Interaction.find(query).sort({ occurredAt: -1 }).limit(Math.min(Number(limit) || 100, 500))
  );

  // `awaitingReport` is a virtual, so it filters after the query.
  if (awaitingReport === 'true' || awaitingReport === true) {
    return visits.filter((v) => v.awaitingReport);
  }
  return visits;
};

exports.getVisitById = async (id) => {
  const visit = await withClient(Interaction.findOne({ _id: id, ...VISIT_QUERY }));
  if (!visit) throw new Error('Visit not found');
  return visit;
};

// ====================
// CREATE / UPDATE
// ====================

const buildPayload = (data) => {
  const visitStatus = data.visitStatus || 'Completed';
  const visitType = data.visitType || (data.discoveryDetails ? 'Discovery' : 'Standard');
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
  const locationName = (data.locationName || '').trim();

  const discoveryDetails = data.discoveryDetails ? {
    operation: data.discoveryDetails.operation || '',
    personnel: data.discoveryDetails.personnel || '',
    contactEmail: data.discoveryDetails.contactEmail || '',
    clientRequest: data.discoveryDetails.clientRequest || '',
    summary: data.discoveryDetails.summary || '',
    painPoints: Array.isArray(data.discoveryDetails.painPoints) ? data.discoveryDetails.painPoints : [],
    propositions: Array.isArray(data.discoveryDetails.propositions) ? data.discoveryDetails.propositions : [],
    usersCount: data.discoveryDetails.usersCount || '',
    processFlow: data.discoveryDetails.processFlow || '',
    additionalNotes: data.discoveryDetails.additionalNotes || '',
  } : undefined;

  return {
    type: 'Site Visit',
    client: data.client,
    visitStatus,
    visitType,
    // A visit still needs the one-line summary every interaction carries, but
    // nobody should have to type it twice — fall back to the purpose, then to
    // a sentence built from where they went.
    summary: (data.summary || '').trim()
      || (data.purpose || '').trim()
      || (discoveryDetails?.clientRequest ? `Discovery — ${discoveryDetails.clientRequest}` : '')
      || (locationName ? `${visitType === 'Discovery' ? 'Discovery Session' : 'Site visit'} — ${locationName}` : 'Site visit'),
    detail: data.detail || '',
    occurredAt,
    loggedBy: data.loggedBy,
    contactName: data.contactName || '',
    sentiment: data.sentiment || 'Neutral',
    followUpNeeded: Boolean(data.followUpNeeded),
    locationName,
    address: data.address || '',
    purpose: data.purpose || '',
    observations: data.observations || '',
    teamAttendees: asList(data.teamAttendees),
    clientAttendees: asList(data.clientAttendees),
    photos: Array.isArray(data.photos) ? data.photos.filter((p) => p && p.url) : [],
    durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : undefined,
    linkedEvent: data.linkedEvent || undefined,
    discoveryDetails,
  };
};

const validate = (payload) => {
  if (!payload.client) throw new Error('Pick which client this visit is for');
  if (!payload.loggedBy) throw new Error('An active team member is required to record a visit');
  if (!payload.locationName) throw new Error('Where did you go? A site or location name is required');
  if (payload.visitStatus === 'Planned' && !payload.occurredAt) {
    throw new Error('A planned visit needs a date');
  }
};


// ====================
// CHANGE TRAIL
// ====================

// The fields worth a trail. Photos and history itself are excluded: photos
// record their own uploader, and an entry about the trail is noise.
const TRACKED = {
  visitStatus: 'Status',
  visitType: 'Visit Type',
  occurredAt: 'Date',
  locationName: 'Site',
  address: 'Address',
  purpose: 'Purpose',
  observations: 'Findings',
  sentiment: 'How it went',
  durationMinutes: 'Time on site',
  teamAttendees: 'Who went',
  clientAttendees: 'Who we met',
  summary: 'Summary',
};

const readable = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
};

/** What actually moved between the stored record and the incoming update. */
const diff = (before, after) => {
  const out = [];
  for (const [field, label] of Object.entries(TRACKED)) {
    if (!(field in after)) continue;
    const from = readable(before[field]);
    const to = readable(after[field]);
    if (from !== to) out.push({ field: label, from, to });
  }
  return out;
};

const noteChange = (visit, { by, action, changes }) => {
  visit.history = visit.history || [];
  visit.history.push({ at: new Date(), by: by || '', action, changes: changes || [] });
};

exports.createVisit = async (data) => {
  const payload = buildPayload(data);
  validate(payload);

  const client = await Client.findById(payload.client);
  if (!client) throw new Error('Client not found');

  const visit = await Interaction.create({
    ...payload,
    history: [{
      at: new Date(),
      by: payload.loggedBy || '',
      action: payload.visitStatus === 'Planned' ? 'Planned' : 'Logged',
      changes: [],
    }],
  });

  // Logging a visit and capturing what you promised on site is one action.
  if (data.commitmentDescription && data.commitmentDescription.trim()) {
    client.commitments.push({
      description: data.commitmentDescription.trim(),
      owner: data.commitmentOwner || data.loggedBy,
      dueDate: data.commitmentDue || undefined,
      createdBy: data.loggedBy,
    });
    await client.save();
  }

  await refreshClientContact(payload.client);
  return withClient(Interaction.findById(visit._id));
};

exports.updateVisit = async (id, data) => {
  const existing = await Interaction.findOne({ _id: id, ...VISIT_QUERY });
  if (!existing) throw new Error('Visit not found');

  const { _id, client, type, ...updates } = data;
  if (updates.teamAttendees !== undefined) updates.teamAttendees = asList(updates.teamAttendees);
  if (updates.clientAttendees !== undefined) updates.clientAttendees = asList(updates.clientAttendees);
  if (updates.occurredAt) updates.occurredAt = new Date(updates.occurredAt);
  if (updates.locationName !== undefined && !String(updates.locationName).trim()) {
    throw new Error('A site or location name is required');
  }
  // The same fallback creation uses. Writing up a booked trip sends the whole
  // form back, and the log form has no summary box — without this, completing a
  // planned visit failed on a field nobody was ever asked for.
  if (updates.summary !== undefined && !String(updates.summary).trim()) {
    updates.summary = String(updates.purpose ?? existing.purpose ?? '').trim()
      || (String(updates.locationName ?? existing.locationName ?? '').trim()
        ? `Site visit — ${updates.locationName ?? existing.locationName}`
        : 'Site visit');
  }

  const changes = diff(existing.toObject(), {
    ...updates,
    ...(updates.occurredAt ? { occurredAt: updates.occurredAt } : {}),
  });
  const becameComplete = updates.visitStatus === 'Completed' && existing.visitStatus !== 'Completed';

  Object.assign(existing, updates);
  noteChange(existing, {
    by: data.changedBy || data.loggedBy || existing.loggedBy,
    action: becameComplete ? 'Written up' : 'Updated',
    changes,
  });
  await existing.save();
  const updated = await withClient(Interaction.findById(id));
  // Marking a planned visit as completed turns it into real contact, so the
  // client's last-contact stamp has to be recomputed.
  await refreshClientContact(existing.client);
  return updated;
};

// Turn a planned visit into a completed one and file the report in a single step.
exports.completeVisit = async (id, data = {}) => {
  const visit = await Interaction.findOne({ _id: id, ...VISIT_QUERY });
  if (!visit) throw new Error('Visit not found');

  const before = visit.toObject();
  visit.visitStatus = 'Completed';
  if (data.observations !== undefined) visit.observations = data.observations;
  if (data.sentiment) visit.sentiment = data.sentiment;
  if (data.durationMinutes) visit.durationMinutes = Number(data.durationMinutes);
  if (data.clientAttendees !== undefined) visit.clientAttendees = asList(data.clientAttendees);
  // A visit marked complete before its planned date actually happened today.
  if (visit.occurredAt > new Date()) visit.occurredAt = new Date();
  noteChange(visit, {
    by: data.completedBy || visit.loggedBy,
    action: 'Written up',
    changes: diff(before, {
      visitStatus: 'Completed',
      observations: visit.observations,
      sentiment: visit.sentiment,
      durationMinutes: visit.durationMinutes,
      clientAttendees: visit.clientAttendees,
    }),
  });
  await visit.save();

  if (data.commitmentDescription && data.commitmentDescription.trim()) {
    const client = await Client.findById(visit.client);
    if (client) {
      client.commitments.push({
        description: data.commitmentDescription.trim(),
        owner: data.commitmentOwner || data.completedBy || '',
        dueDate: data.commitmentDue || undefined,
        createdBy: data.completedBy || '',
      });
      await client.save();
    }
  }

  await refreshClientContact(visit.client);
  return withClient(Interaction.findById(visit._id));
};

exports.deleteVisit = async (id) => {
  const deleted = await Interaction.findOneAndDelete({ _id: id, ...VISIT_QUERY });
  if (!deleted) throw new Error('Visit not found');
  await refreshClientContact(deleted.client);
  return deleted;
};

// ====================
// PHOTOS
// ====================

exports.addVisitPhoto = async (id, photo) => {
  const visit = await Interaction.findOne({ _id: id, ...VISIT_QUERY });
  if (!visit) throw new Error('Visit not found');
  if (!photo?.url) throw new Error('A photo file is required');
  visit.photos.push({ url: photo.url, caption: photo.caption || '' });
  await visit.save();
  return withClient(Interaction.findById(visit._id));
};

exports.deleteVisitPhoto = async (id, photoId) => {
  const visit = await Interaction.findOne({ _id: id, ...VISIT_QUERY });
  if (!visit) throw new Error('Visit not found');
  const photo = visit.photos.id(photoId);
  if (!photo) throw new Error('Photo not found');
  photo.deleteOne();
  await visit.save();
  return withClient(Interaction.findById(visit._id));
};

// ====================
// DASHBOARD
// ====================

exports.getVisitStats = async () => {
  const visits = await withClient(Interaction.find(VISIT_QUERY).sort({ occurredAt: -1 }));
  const today = startOfToday();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const upcoming = visits
    .filter((v) => v.visitStatus === 'Planned' && v.occurredAt >= today)
    .sort((a, b) => a.occurredAt - b.occurredAt);

  // The trip happened but nobody wrote it up — the knowledge is still stuck in
  // someone's head, which is exactly what this module exists to prevent.
  const awaitingReport = visits
    .filter((v) => v.awaitingReport)
    .sort((a, b) => a.occurredAt - b.occurredAt);

  // A planned date that has passed with nobody marking it done either way.
  const overduePlanned = visits.filter(
    (v) => v.visitStatus === 'Planned' && v.occurredAt < today
  );

  const completed = visits.filter((v) => v.visitStatus === 'Completed');
  const thisMonth = completed.filter((v) => v.occurredAt >= monthStart);

  const byPerson = {};
  for (const visit of thisMonth) {
    byPerson[visit.loggedBy] = (byPerson[visit.loggedBy] || 0) + 1;
  }

  // Which accounts have actually been seen in person this quarter.
  const ninetyDaysAgo = new Date(today.getTime() - 90 * MS_PER_DAY);
  const clientsVisited = new Set(
    completed.filter((v) => v.occurredAt >= ninetyDaysAgo && v.client)
      .map((v) => String(v.client._id))
  );
  const activeClients = await Client.countDocuments({
    archived: { $ne: true },
    status: { $in: ['Active', 'Onboarding'] },
  });

  return {
    totals: {
      completed: completed.length,
      thisMonth: thisMonth.length,
      planned: upcoming.length,
      awaitingReport: awaitingReport.length,
      overduePlanned: overduePlanned.length,
      photos: visits.reduce((sum, v) => sum + (v.photos?.length || 0), 0),
      clientsVisited90d: clientsVisited.size,
      activeClients,
    },
    upcoming: upcoming.slice(0, 8),
    awaitingReport: awaitingReport.slice(0, 8),
    overduePlanned: overduePlanned.slice(0, 8),
    byPerson: Object.entries(byPerson)
      .map(([person, count]) => ({ person, count }))
      .sort((a, b) => b.count - a.count),
  };
};
