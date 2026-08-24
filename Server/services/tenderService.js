// ============================================
// Tenders & EOI.
//
// Extracted from bdService.js, which held only thin CRUD. This module is about
// deadlines that cost real money when missed, so the logic that matters is the
// deadline runway, the bid/no-bid decision trail, and promoting an EOI into a
// tender without retyping it.
//
// Boundary with Proposals: a Tender is the OPPORTUNITY and the work of
// preparing a bid. A Proposal is the BID and its win/loss record. They are
// joined by Proposal.linkedTender; neither stores the other's data.
// ============================================

const Tender = require('../models/Tender');
const Eoi = require('../models/Eoi');
const Proposal = require('../models/Proposal');
const Reminder = require('../models/Reminder');
const lookups = require('./lookups');

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

const normaliseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// Empty strings from date inputs must clear the field, not fail to cast.
const asDate = (v) => (v === '' || v === null || v === undefined ? null : new Date(v));

const TENDER_SORTS = {
  deadline: { deadline: 1 },
  recent: { createdAt: -1 },
  value: { estimatedValue: -1 },
  title: { title: 1 },
  status: { status: 1, deadline: 1 },
};

// ====================
// TENDERS
// ====================

exports.getAllTenders = async (filters = {}) => {
  const { status, source, tenderType, owner, search, includeArchived, sort = 'deadline', view } = filters;

  const query = {};
  if (status) query.status = status;
  if (source) query.source = source;
  if (tenderType) query.tenderType = tenderType;
  if (owner) query.owner = owner;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [
      { title: rx }, { reference: rx }, { issuingAuthority: rx }, { sector: rx },
      { owner: rx }, { notes: rx }, { tags: rx }, { sourceDetail: rx },
    ];
  }

  const tenders = await Tender.find(query)
    .sort(TENDER_SORTS[sort] || TENDER_SORTS.deadline)
    .populate('sourceEoi', 'title reference');

  // deadlineStatus and isMissed are virtuals, so these views filter in memory.
  if (view === 'missed') return tenders.filter((t) => t.isMissed);
  if (view === 'closing') return tenders.filter((t) => ['Due Today', 'Closing Soon', 'Overdue'].includes(t.deadlineStatus));
  if (view === 'open') return tenders.filter((t) => !t.isClosed && !t.isSubmitted);
  return tenders;
};

exports.getTenderById = async (id) => {
  const tender = await Tender.findById(id).populate('sourceEoi', 'title reference source');
  if (!tender) throw new Error('Tender not found');
  return tender;
};

const buildTenderPayload = (data) => ({
  title: clean(data.title) || '',
  reference: data.reference || '',
  source: data.source || 'Other',
  sourceDetail: data.sourceDetail || '',
  sourceLink: data.sourceLink || '',
  sourceImageUrl: data.sourceImageUrl || '',
  sourceImageName: data.sourceImageName || '',
  issuingAuthority: data.issuingAuthority || '',
  sector: data.sector || '',
  customSector: data.customSector || '',
  tenderType: data.tenderType || 'Opened',
  openedDate: asDate(data.openedDate) || undefined,
  deadline: asDate(data.deadline) || undefined,
  status: data.status || 'Open',
  owner: data.owner || '',
  estimatedValue: Number(data.estimatedValue) || 0,
  currency: data.currency || '',
  pdp: data.pdp || { milestones: [], individuals: [], progress: 0 },
  fdp: data.fdp || {},
  sourceEoi: data.sourceEoi || undefined,
  tags: normaliseTags(data.tags),
  notes: data.notes || '',
});

// A notice nobody can re-open is not a lead, so whichever field the source
// calls for has to be filled in. See Tender.SOURCE_REQUIREMENTS.
const assertSourceDirection = (record) => {
  const rule = Tender.SOURCE_REQUIREMENTS[record.source];
  if (!rule) return;
  if (clean(record[rule.field])) return;
  // A tender promoted from an EOI already has a trail: the EOI record holds the
  // original notice. Demanding a link the EOI never collected would block every
  // conversion on a field nobody was asked for at the time.
  if (record.sourceEoi) return;
  throw new Error(`${record.source} tenders need "${rule.label}" — without it nobody can find this tender again.`);
};

// A tender cannot close before it opens.
const assertDateOrder = (record) => {
  if (record.openedDate && record.deadline && record.openedDate > record.deadline) {
    throw new Error('The tender cannot open after its own deadline.');
  }
};

// 'Others' is a placeholder, not a sector — it only means anything with the
// real one written next to it.
const assertSector = (record) => {
  if (record.sector === 'Others' && !clean(record.customSector)) {
    throw new Error('Pick a sector, or choose "Others" and say which sector it is.');
  }
};

exports.createTender = async (data) => {
  const payload = buildTenderPayload(data);
  if (!payload.title) throw new Error('Give the tender a title');
  assertSourceDirection(payload);
  assertDateOrder(payload);
  assertSector(payload);
  const created = await Tender.create(payload);
  return exports.getTenderById(created._id);
};

exports.updateTender = async (id, data) => {
  const tender = await Tender.findById(id);
  if (!tender) throw new Error('Tender not found');

  const { _id, ...updates } = data;
  if (updates.title !== undefined && !clean(updates.title)) {
    throw new Error('A tender needs a title');
  }
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);
  for (const field of ['openedDate', 'deadline', 'submittedAt', 'decidedAt']) {
    if (field in updates) updates[field] = asDate(updates[field]);
  }
  if (updates.estimatedValue !== undefined) updates.estimatedValue = Number(updates.estimatedValue) || 0;

  Object.assign(tender, updates);
  // Checked against the merged record, so a partial edit cannot slip a tender
  // past a rule the whole record still has to satisfy.
  assertSourceDirection(tender);
  assertDateOrder(tender);
  assertSector(tender);
  await tender.save(); // save(), so the pre-save date stamping runs
  return exports.getTenderById(tender._id);
};

exports.setTenderArchived = async (id, archived) => {
  const tender = await Tender.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!tender) throw new Error('Tender not found');
  return tender;
};

// Archive-first, as everywhere else. A tender carries the whole bid-preparation
// record, so it should not vanish on one click.
exports.deleteTender = async (id) => {
  const tender = await Tender.findById(id);
  if (!tender) throw new Error('Tender not found');
  if (!tender.archived) {
    throw new Error('Archive this tender before deleting — the delivery and pricing plans go with it.');
  }
  await Reminder.deleteMany({ sourceType: 'Tender', sourceId: id });
  await Eoi.updateMany({ convertedToTender: id }, { $set: { convertedToTender: null } });
  await tender.deleteOne();
  return tender;
};

// ====================
// PDP MILESTONES
// ====================

exports.setMilestoneDone = async (tenderId, milestoneId, done) => {
  const tender = await Tender.findById(tenderId);
  if (!tender) throw new Error('Tender not found');
  const milestone = tender.pdp.milestones.id(milestoneId);
  if (!milestone) throw new Error('Milestone not found');
  milestone.done = done;
  milestone.completedAt = done ? new Date() : null;
  await tender.save();
  return exports.getTenderById(tenderId);
};

// ====================
// EOIs
// ====================

exports.getAllEois = async (filters = {}) => {
  const { status, source, decision, owner, search, includeArchived, view } = filters;

  const query = {};
  if (status) query.status = status;
  if (source) query.source = source;
  if (decision) query.decision = decision;
  if (owner) query.owner = owner;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [
      { title: rx }, { reference: rx }, { issuingAuthority: rx }, { sector: rx },
      { owner: rx }, { notes: rx }, { decisionReason: rx }, { sourceDetail: rx },
    ];
  }

  const eois = await Eoi.find(query)
    .sort({ deadline: 1, createdAt: -1 })
    .populate('convertedToTender', 'title reference status');

  if (view === 'awaiting') return eois.filter((e) => e.awaitingDecision);
  return eois;
};

exports.getEoiById = async (id) => {
  const eoi = await Eoi.findById(id).populate('convertedToTender', 'title reference status deadline');
  if (!eoi) throw new Error('EOI not found');
  return eoi;
};

const buildEoiPayload = (data) => ({
  title: clean(data.title) || '',
  reference: data.reference || '',
  source: data.source || 'Other',
  sourceDetail: data.sourceDetail || '',
  issuingAuthority: data.issuingAuthority || '',
  sector: data.sector || '',
  deadline: asDate(data.deadline) || undefined,
  status: data.status || 'Open',
  owner: data.owner || '',
  decision: data.decision || 'Undecided',
  decisionReason: data.decisionReason || '',
  decidedBy: data.decidedBy || '',
  attachmentType: data.attachmentType || '',
  attachmentUrl: data.attachmentUrl || '',
  attachmentFileName: data.attachmentFileName || '',
  tags: normaliseTags(data.tags),
  notes: data.notes || '',
});

exports.createEoi = async (data) => {
  const payload = buildEoiPayload(data);
  if (!payload.title) throw new Error('Give the EOI a title');
  // A link and an upload are alternatives, never both.
  if (payload.attachmentType === 'link' && !payload.attachmentUrl) {
    throw new Error('Paste the link, or switch to a file upload');
  }
  const created = await Eoi.create(payload);
  return exports.getEoiById(created._id);
};

exports.updateEoi = async (id, data) => {
  const eoi = await Eoi.findById(id);
  if (!eoi) throw new Error('EOI not found');

  const { _id, ...updates } = data;
  if (updates.title !== undefined && !clean(updates.title)) {
    throw new Error('An EOI needs a title');
  }
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);
  if ('deadline' in updates) updates.deadline = asDate(updates.deadline);

  Object.assign(eoi, updates);
  await eoi.save();
  return exports.getEoiById(eoi._id);
};

// Recording a Pass is the whole point of the EOI list: it stops the same notice
// being reconsidered from scratch. So a Pass must say why.
exports.setEoiDecision = async (id, { decision, decisionReason, decidedBy }) => {
  const eoi = await Eoi.findById(id);
  if (!eoi) throw new Error('EOI not found');
  if (!Eoi.DECISIONS.includes(decision)) throw new Error(`"${decision}" is not a valid decision`);
  if (decision === 'Pass' && !clean(decisionReason)) {
    throw new Error('Say why we are passing — an unexplained pass teaches the team nothing');
  }

  eoi.decision = decision;
  if (decisionReason !== undefined) eoi.decisionReason = decisionReason;
  if (decidedBy !== undefined) eoi.decidedBy = decidedBy;
  if (decision === 'Undecided') {
    eoi.decidedAt = null;
    eoi.decidedBy = '';
  }
  await eoi.save();
  return exports.getEoiById(id);
};

exports.setEoiArchived = async (id, archived) => {
  const eoi = await Eoi.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!eoi) throw new Error('EOI not found');
  return eoi;
};

exports.deleteEoi = async (id) => {
  const eoi = await Eoi.findById(id);
  if (!eoi) throw new Error('EOI not found');
  if (!eoi.archived) {
    throw new Error('Archive this EOI before deleting — the decision trail goes with it.');
  }
  await Reminder.deleteMany({ sourceType: 'Eoi', sourceId: id });
  await eoi.deleteOne();
  return eoi;
};

/**
 * Promote an EOI into a full tender. Everything already captured carries over,
 * so nobody retypes a reference number or a deadline — the commonest way a
 * detail gets transcribed wrong. Mirrors convertColdCallToProspectingLead and
 * convertPipelineItemToClient.
 */
exports.convertEoiToTender = async (eoiId, overrides = {}) => {
  const eoi = await Eoi.findById(eoiId);
  if (!eoi) throw new Error('EOI not found');
  if (eoi.convertedToTender) {
    throw new Error(`"${eoi.title}" has already been converted to a tender.`);
  }

  // EOI sectors are free text; tender sectors are an enum. Anything that is
  // not one of the six is kept verbatim under 'Others' rather than dropped or
  // — worse — failing the conversion on a field nobody was asked about.
  const known = Tender.SECTORS.includes(eoi.sector);
  const sector = eoi.sector ? (known ? eoi.sector : 'Others') : '';
  const customSector = known ? '' : (eoi.sector || '');

  // The EOI's own notice is the tender's way back to the source, so an
  // uploaded clipping carries across and satisfies the requirement.
  const carried = eoi.attachmentType === 'upload'
    ? { sourceImageUrl: eoi.attachmentUrl, sourceImageName: eoi.attachmentFileName }
    : { sourceLink: eoi.attachmentUrl || '' };

  // When the EOI carried nothing, say plainly where this came from, so the
  // record still answers "how do we get back to it".
  const provenance = clean(eoi.sourceDetail)
    || `From EOI ${eoi.reference || eoi.title} — see the linked notice`;

  const payload = buildTenderPayload({
    title: eoi.title,
    reference: eoi.reference,
    source: eoi.source,
    sourceDetail: provenance,
    ...carried,
    issuingAuthority: eoi.issuingAuthority,
    sector,
    customSector,
    deadline: eoi.deadline,
    owner: eoi.owner,
    tags: eoi.tags,
    notes: eoi.notes,
    sourceEoi: eoi._id,
    ...overrides,
  });
  assertSourceDirection(payload);
  assertDateOrder(payload);
  assertSector(payload);

  const tender = await Tender.create(payload);

  eoi.convertedToTender = tender._id;
  // Converting IS the decision to pursue.
  if (eoi.decision === 'Undecided') {
    eoi.decision = 'Pursue';
    eoi.decidedBy = overrides.owner || eoi.owner || '';
  }
  await eoi.save();

  return exports.getTenderById(tender._id);
};

// ====================
// DEADLINE RUNWAY & STATS
// ====================

/**
 * The question this module exists to answer: what is closing, and when?
 * One list across both tenders and EOIs, because a deadline does not care
 * which tab it lives on.
 */
exports.getDeadlineRunway = async (withinDays = 60) => {
  const [tenders, eois] = await Promise.all([
    Tender.find({ archived: { $ne: true }, deadline: { $ne: null } }),
    Eoi.find({ archived: { $ne: true }, deadline: { $ne: null } }),
  ]);

  const items = [];

  for (const t of tenders) {
    if (t.isClosed || t.isSubmitted) continue;
    const days = t.daysToDeadline;
    if (days === null || days > withinDays) continue;
    items.push({
      kind: 'Tender',
      _id: t._id,
      title: t.title,
      reference: t.reference,
      issuingAuthority: t.issuingAuthority,
      owner: t.owner,
      deadline: t.deadline,
      daysToDeadline: days,
      deadlineStatus: t.deadlineStatus,
      status: t.status,
      value: t.estimatedValue,
      isMissed: t.isMissed,
    });
  }

  for (const e of eois) {
    if (e.convertedToTender || e.decision === 'Pass' || e.status === 'Closed') continue;
    const days = e.daysToDeadline;
    if (days === null || days > withinDays) continue;
    items.push({
      kind: 'EOI',
      _id: e._id,
      title: e.title,
      reference: e.reference,
      issuingAuthority: e.issuingAuthority,
      owner: e.owner,
      deadline: e.deadline,
      daysToDeadline: days,
      deadlineStatus: e.deadlineStatus,
      status: e.status,
      decision: e.decision,
      isMissed: days < 0,
    });
  }

  return items.sort((a, b) => a.daysToDeadline - b.daysToDeadline);
};

exports.getTenderStats = async () => {
  const [tenders, eois, runway] = await Promise.all([
    Tender.find({ archived: { $ne: true } }),
    Eoi.find({ archived: { $ne: true } }),
    exports.getDeadlineRunway(60),
  ]);

  const byStatus = {};
  for (const t of tenders) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

  const submitted = tenders.filter((t) => t.isSubmitted).length;
  const won = tenders.filter((t) => t.status === 'Won').length;
  const lost = tenders.filter((t) => t.status === 'Lost').length;
  const decided = won + lost;

  const open = tenders.filter((t) => !t.isClosed && !t.isSubmitted);
  const missed = tenders.filter((t) => t.isMissed);

  // How many opportunities we bid on versus walked away from. A high pass rate
  // is not automatically bad — an unexamined one is.
  const passed = eois.filter((e) => e.decision === 'Pass').length;
  const pursued = eois.filter((e) => e.decision === 'Pursue').length;

  return {
    totals: {
      tenders: tenders.length,
      open: open.length,
      closingSoon: runway.filter((r) => r.kind === 'Tender' && r.daysToDeadline >= 0 && r.daysToDeadline <= 7).length,
      missed: missed.length,
      submitted,
      won,
      lost,
      winRate: decided > 0 ? Math.round((won / decided) * 1000) / 10 : null,
      pipelineValue: open.reduce((sum, t) => sum + (t.estimatedValue || 0), 0),
      wonValue: tenders.filter((t) => t.status === 'Won').reduce((s, t) => s + (t.estimatedValue || 0), 0),
      eois: eois.length,
      eoisAwaitingDecision: eois.filter((e) => e.awaitingDecision).length,
      eoisPursued: pursued,
      eoisPassed: passed,
    },
    byStatus,
    runway: runway.slice(0, 12),
    missed: missed.slice(0, 8).map((t) => ({
      _id: t._id, title: t.title, deadline: t.deadline,
      daysToDeadline: t.daysToDeadline, owner: t.owner, issuingAuthority: t.issuingAuthority,
    })),
  };
};

// Surfaces the bid that answered this tender without duplicating its record.
exports.getLinkedProposals = async (tenderId) =>
  Proposal.find({ linkedTender: tenderId }).select('title stage value owner submissionDeadline lossReason');

exports.getTenderOwners = async () =>
  lookups.peopleFor([[Tender, 'owner'], [Eoi, 'owner']]);

exports.getIssuingAuthorities = async () => {
  const [t, e] = await Promise.all([
    Tender.distinct('issuingAuthority', { archived: { $ne: true } }),
    Eoi.distinct('issuingAuthority', { archived: { $ne: true } }),
  ]);
  return lookups.tidy([t, e]);
};
