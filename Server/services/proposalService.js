// ============================================
// Proposals — client-facing bids.
//
// Two things this module exists to do that a list of documents cannot:
//   1. stop proposals dying of silence after submission, and
//   2. build a win/loss record with structured reasons.
// Everything below serves one of those.
//
// The proposal document itself lives in Reports & Docs and the case studies in
// Blog & Content; this service links to them and never holds a copy.
// ============================================

const Proposal = require('../models/Proposal');
const lookups = require('./lookups');

const normaliseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
};

const PROPOSAL_SORTS = {
  deadline: { submissionDeadline: 1 },
  recent: { createdAt: -1 },
  value: { value: -1 },
  title: { title: 1 },
  stage: { stage: 1, submissionDeadline: 1 },
};

const withLinks = (query) =>
  query
    .populate('client', 'name tier sector accountOwner')
    .populate('proposalDoc', 'title fileUrl fileType category version')
    .populate('caseStudies', 'title contentType quantifiableResults categorySector')
    .populate('linkedTender', 'title category deadline')
    .populate('linkedPipelineItem', 'name type value');

// ====================
// QUERIES
// ====================

exports.getProposals = async (filters = {}) => {
  const { stage, origin, owner, sector, search, cold, open, includeArchived, sort = 'deadline' } = filters;

  const query = {};
  if (stage) query.stage = stage;
  if (origin) query.origin = origin;
  if (owner) query.owner = owner;
  if (sector) query.sector = sector;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };
  if (open === 'true' || open === true) query.stage = { $nin: Proposal.CLOSED_STAGES };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [
      { title: rx }, { reference: rx }, { prospectName: rx }, { sector: rx },
      { owner: rx }, { contactName: rx }, { notes: rx }, { tags: rx },
      { competitor: rx }, { outcomeNote: rx },
    ];
  }

  const proposals = await withLinks(Proposal.find(query).sort(PROPOSAL_SORTS[sort] || PROPOSAL_SORTS.deadline));

  // `isCold` is a virtual, so it filters after the query.
  if (cold === 'true' || cold === true) return proposals.filter((p) => p.isCold);
  return proposals;
};

exports.getProposalById = async (id) => {
  const proposal = await withLinks(Proposal.findById(id));
  if (!proposal) throw new Error('Proposal not found');
  return proposal;
};

exports.getProposalOwners = async () =>
  lookups.peopleFor([[Proposal, 'owner']]);

exports.getProposalSectors = async () =>
  lookups.distinctList([[Proposal, 'sector']]);

// ====================
// CREATE / UPDATE
// ====================

const buildPayload = (data) => ({
  title: (data.title || '').trim(),
  reference: data.reference || '',
  origin: data.origin || 'RFP / Requested',
  stage: data.stage || 'Drafting',
  client: data.client || undefined,
  prospectName: data.prospectName || '',
  sector: data.sector || '',
  contactName: data.contactName || '',
  owner: data.owner || '',
  contributors: normaliseList(data.contributors),
  value: Number(data.value) || 0,
  issuedDate: data.issuedDate || undefined,
  submissionDeadline: data.submissionDeadline || undefined,
  submittedDate: data.submittedDate || undefined,
  decisionExpected: data.decisionExpected || undefined,
  lossReason: data.lossReason || undefined,
  outcomeNote: data.outcomeNote || '',
  competitor: data.competitor || '',
  proposalDoc: data.proposalDoc || undefined,
  caseStudies: Array.isArray(data.caseStudies) ? data.caseStudies.filter(Boolean) : [],
  linkedTender: data.linkedTender || undefined,
  linkedPipelineItem: data.linkedPipelineItem || undefined,
  checklist: Array.isArray(data.checklist) ? data.checklist : [],
  tags: normaliseList(data.tags),
  notes: data.notes || '',
});

exports.createProposal = async (data) => {
  const payload = buildPayload(data);
  if (!payload.title) throw new Error('Give the proposal a title');
  if (!payload.client && !payload.prospectName.trim()) {
    throw new Error('Say who this is for — pick a client or type a prospect name');
  }
  const created = await Proposal.create(payload);
  return withLinks(Proposal.findById(created._id));
};

exports.updateProposal = async (id, data) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');

  const { _id, checklist, followUps, ...updates } = data;
  if (updates.tags !== undefined) updates.tags = normaliseList(updates.tags);
  if (updates.contributors !== undefined) updates.contributors = normaliseList(updates.contributors);
  if (updates.value !== undefined) updates.value = Number(updates.value) || 0;
  for (const field of ['client', 'proposalDoc', 'linkedTender', 'linkedPipelineItem',
    'issuedDate', 'submissionDeadline', 'submittedDate', 'decisionExpected', 'decidedDate']) {
    if (updates[field] === '') updates[field] = null;
  }
  if (updates.lossReason === '') updates.lossReason = undefined;

  Object.assign(proposal, updates);
  await proposal.save(); // save(), so the pre-validate stage rules run
  return withLinks(Proposal.findById(proposal._id));
};

// Moving stage is the commonest action, and the one place the module insists on
// something: a loss without a reason is a lesson thrown away.
exports.setStage = async (id, data) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');

  const { stage, lossReason, outcomeNote, competitor } = data;
  if (!Proposal.STAGES.includes(stage)) throw new Error(`"${stage}" is not a valid stage`);
  if (stage === 'Lost' && !lossReason) {
    throw new Error('Record why it was lost — an unexplained loss teaches the team nothing');
  }

  proposal.stage = stage;
  if (lossReason !== undefined) proposal.lossReason = lossReason || undefined;
  if (outcomeNote !== undefined) proposal.outcomeNote = outcomeNote;
  if (competitor !== undefined) proposal.competitor = competitor;
  if (stage === 'Submitted' && !proposal.submittedDate) proposal.submittedDate = new Date();

  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

exports.setProposalArchived = async (id, archived) => {
  const proposal = await Proposal.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!proposal) throw new Error('Proposal not found');
  return proposal;
};

exports.deleteProposal = async (id) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  if (!proposal.archived) {
    throw new Error('Archive this proposal before deleting — the win/loss record is worth keeping.');
  }
  await proposal.deleteOne();
  return proposal;
};

// ====================
// CHECKLIST & FOLLOW-UPS
// ====================

exports.addChecklistItem = async (id, item) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  if (!item?.taskName?.trim()) throw new Error('Describe what needs doing');
  proposal.checklist.push({
    taskName: item.taskName.trim(),
    assignedTo: item.assignedTo || '',
    dueDate: item.dueDate || undefined,
  });
  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

exports.setChecklistItemDone = async (id, itemId, completed) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  const item = proposal.checklist.id(itemId);
  if (!item) throw new Error('Checklist item not found');
  item.completed = completed;
  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

exports.deleteChecklistItem = async (id, itemId) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  const item = proposal.checklist.id(itemId);
  if (!item) throw new Error('Checklist item not found');
  item.deleteOne();
  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

// Logging a chase resets the silence clock — which is the whole reason the
// cold calculation measures from the last follow-up rather than submission.
exports.addFollowUp = async (id, followUp) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  if (!followUp?.note?.trim()) throw new Error('Say what you chased them about');
  proposal.followUps.push({
    date: followUp.date || new Date(),
    by: followUp.by || '',
    note: followUp.note.trim(),
    response: followUp.response || '',
  });
  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

exports.deleteFollowUp = async (id, followUpId) => {
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new Error('Proposal not found');
  const followUp = proposal.followUps.id(followUpId);
  if (!followUp) throw new Error('Follow-up not found');
  followUp.deleteOne();
  await proposal.save();
  return withLinks(Proposal.findById(proposal._id));
};

// ====================
// DASHBOARD & WIN/LOSS ANALYTICS
// ====================

const SEVERITY_RANK = { Critical: 0, 'At Risk': 1, Watch: 2 };

exports.getProposalStats = async () => {
  const proposals = await Proposal.find({ archived: { $ne: true } })
    .populate('client', 'name');

  const open = proposals.filter((p) => !p.isClosed);
  const won = proposals.filter((p) => p.stage === 'Won');
  const lost = proposals.filter((p) => p.stage === 'Lost');
  const decided = won.length + lost.length;

  const byStage = {};
  for (const stage of Proposal.STAGES) byStage[stage] = { count: 0, value: 0 };
  for (const p of proposals) {
    byStage[p.stage].count += 1;
    byStage[p.stage].value += p.value || 0;
  }

  // Win rate by count and by value — they often disagree, and the gap is the
  // interesting part (winning many small bids, losing the big ones).
  const wonValue = won.reduce((s, p) => s + (p.value || 0), 0);
  const lostValue = lost.reduce((s, p) => s + (p.value || 0), 0);

  const lossReasons = {};
  for (const p of lost) {
    const reason = p.lossReason || 'Other';
    lossReasons[reason] = lossReasons[reason] || { count: 0, value: 0 };
    lossReasons[reason].count += 1;
    lossReasons[reason].value += p.value || 0;
  }

  const bySector = {};
  for (const p of [...won, ...lost]) {
    const key = p.sector || 'Unspecified';
    bySector[key] = bySector[key] || { won: 0, lost: 0 };
    if (p.stage === 'Won') bySector[key].won += 1;
    else bySector[key].lost += 1;
  }

  // Average days from submission to decision, for forecasting how long the
  // current pipeline will take to resolve.
  const turnarounds = [...won, ...lost]
    .filter((p) => p.submittedDate && p.decidedDate)
    .map((p) => Math.round((new Date(p.decidedDate) - new Date(p.submittedDate)) / (24 * 60 * 60 * 1000)))
    .filter((d) => d >= 0);
  const avgDaysToDecision = turnarounds.length
    ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
    : null;

  const needsAttention = open
    .filter((p) => p.attentionReasons.length > 0)
    .map((p) => ({
      _id: p._id,
      title: p.title,
      who: p.client?.name || p.prospectName,
      owner: p.owner,
      value: p.value,
      stage: p.stage,
      reasons: p.attentionReasons,
      worst: p.attentionReasons.reduce(
        (worst, r) => (SEVERITY_RANK[r.severity] < SEVERITY_RANK[worst] ? r.severity : worst),
        'Watch'
      ),
    }))
    .sort((a, b) => SEVERITY_RANK[a.worst] - SEVERITY_RANK[b.worst]);

  const upcomingDeadlines = open
    .filter((p) => p.daysToDeadline !== null && p.daysToDeadline >= 0)
    .sort((a, b) => a.daysToDeadline - b.daysToDeadline)
    .slice(0, 8)
    .map((p) => ({
      _id: p._id, title: p.title, owner: p.owner, value: p.value,
      daysToDeadline: p.daysToDeadline, submissionDeadline: p.submissionDeadline,
      openChecklistItems: p.openChecklistItems,
      who: p.client?.name || p.prospectName,
    }));

  return {
    totals: {
      open: open.length,
      openValue: open.reduce((s, p) => s + (p.value || 0), 0),
      // The number leadership actually asks for.
      weightedForecast: open.reduce((s, p) => s + p.weightedValue, 0),
      won: won.length,
      lost: lost.length,
      cold: open.filter((p) => p.isCold).length,
      dueThisWeek: open.filter((p) => p.daysToDeadline !== null && p.daysToDeadline >= 0 && p.daysToDeadline <= 7).length,
      winRateByCount: decided ? Math.round((won.length / decided) * 100) : null,
      winRateByValue: (wonValue + lostValue) ? Math.round((wonValue / (wonValue + lostValue)) * 100) : null,
      wonValue,
      avgDaysToDecision,
    },
    byStage,
    lossReasons: Object.entries(lossReasons)
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.count - a.count),
    bySector: Object.entries(bySector)
      .map(([sector, v]) => ({ sector, ...v, total: v.won + v.lost }))
      .sort((a, b) => b.total - a.total),
    needsAttention: needsAttention.slice(0, 10),
    upcomingDeadlines,
  };
};
