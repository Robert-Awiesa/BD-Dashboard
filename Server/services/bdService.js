// ============================================
// MongoDB-backed data services (Mongoose)
// API surface (function names & signatures)
// matches the original in-memory implementation.
// ============================================

const Pipeline = require('../models/Pipeline');
const Tender = require('../models/Tender');
const ProspectingLead = require('../models/ProspectingLead');
const ColdCall = require('../models/ColdCall');
const SocialContent = require('../models/SocialContent');
const Campaign = require('../models/Campaign');
const Reminder = require('../models/Reminder');
const Event = require('../models/Event');
const Milestone = require('../models/Milestone');
const DgEvent = require('../models/DgEvent');

// ====================
// PIPELINE SERVICES
// ====================

exports.getAllPipeline = async () => {
  return Pipeline.find().sort({ createdAt: -1 });
};

exports.createPipeline = async (data) => {
  return Pipeline.create({
    name: data.name,
    type: data.type,
    status: data.status || 'active',
    contact: data.contact || '',
    priority: data.priority || 'Medium',
    value: data.value || 0,
    nextFollowUp: data.nextFollowUp || '',
    source: data.source || '',
    notes: data.notes || '',
  });
};

exports.updatePipeline = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await Pipeline.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Pipeline item not found');
  return updated;
};

exports.deletePipeline = async (id) => {
  const deleted = await Pipeline.findByIdAndDelete(id);
  if (!deleted) throw new Error('Pipeline item not found');
  return deleted;
};

// ====================
// TENDER SERVICES
// ====================

exports.getAllTenders = async () => {
  return Tender.find().sort({ createdAt: -1 });
};

exports.createTender = async (data) => {
  return Tender.create({
    title: data.title,
    category: data.category,
    deadline: data.deadline || '',
    status: data.status || 'active',
  });
};

exports.updateTender = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await Tender.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Tender item not found');
  return updated;
};

exports.deleteTender = async (id) => {
  const deleted = await Tender.findByIdAndDelete(id);
  if (!deleted) throw new Error('Tender item not found');
  return deleted;
};

// ====================
// PROSPECTING LEAD SERVICES
// ====================

exports.getAllProspectingLeads = async () => {
  return ProspectingLead.find().sort({ createdAt: -1 });
};

exports.createProspectingLead = async (data) => {
  return ProspectingLead.create(data);
};

exports.bulkCreateProspectingLeads = async (leads) => {
  return ProspectingLead.insertMany(leads, { ordered: false });
};

exports.updateProspectingLead = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await ProspectingLead.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Prospecting lead not found');
  return updated;
};

exports.deleteProspectingLead = async (id) => {
  const deleted = await ProspectingLead.findByIdAndDelete(id);
  if (!deleted) throw new Error('Prospecting lead not found');
  return deleted;
};

// ====================
// COLD CALL SERVICES
// ====================

exports.getAllColdCalls = async () => {
  return ColdCall.find().sort({ createdAt: -1 });
};

exports.createColdCall = async (data) => {
  return ColdCall.create(data);
};

exports.updateColdCall = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await ColdCall.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Cold call not found');
  return updated;
};

exports.deleteColdCall = async (id) => {
  const deleted = await ColdCall.findByIdAndDelete(id);
  if (!deleted) throw new Error('Cold call not found');
  return deleted;
};

// Promote a cold call to a Prospecting Lead: creates the lead from the call's
// known fields and stamps the call with a reference so it shows as converted.
exports.convertColdCallToProspectingLead = async (id, overrides = {}) => {
  const call = await ColdCall.findById(id);
  if (!call) throw new Error('Cold call not found');
  if (call.convertedToProspectingLead) {
    throw new Error('This cold call has already been converted to a prospecting lead');
  }

  const lead = await ProspectingLead.create({
    company: call.prospectName,
    industry: call.industry,
    customIndustry: call.customIndustry,
    contactPerson: call.prospectName,
    primaryEmail: overrides.primaryEmail,
    primaryContact: call.phoneNumber,
    opportunityStage: 'Qualified',
    companyChallenge: call.notes,
    ...overrides,
  });

  call.convertedToProspectingLead = lead._id;
  await call.save();

  return { call, lead };
};

// ====================
// SOCIAL CONTENT ENGINE SERVICES
// ====================

exports.getAllSocialContent = async (filters = {}) => {
  const query = {};
  if (filters.platform) query.platform = filters.platform;
  if (filters.status) query.status = filters.status;
  return SocialContent.find(query).sort({ scheduleDate: 1, createdAt: -1 });
};

exports.createSocialContent = async (data) => {
  return SocialContent.create(data);
};

exports.updateSocialContent = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await SocialContent.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Social content entry not found');
  return updated;
};

exports.deleteSocialContent = async (id) => {
  const deleted = await SocialContent.findByIdAndDelete(id);
  if (!deleted) throw new Error('Social content entry not found');
  return deleted;
};

// ====================
// CAMPAIGN SERVICES
// ====================

exports.getAllCampaigns = async (filters = {}) => {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.platform) query.platforms = filters.platform;
  return Campaign.find(query).sort({ startDate: 1, createdAt: -1 });
};

exports.getCampaignById = async (id) => {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  return campaign;
};

exports.createCampaign = async (data) => {
  return Campaign.create(data);
};

exports.updateCampaign = async (id, data) => {
  const { _id, ...updates } = data;
  const updated = await Campaign.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Campaign not found');
  return updated;
};

exports.deleteCampaign = async (id) => {
  const deleted = await Campaign.findByIdAndDelete(id);
  if (!deleted) throw new Error('Campaign not found');
  await Reminder.deleteMany({ sourceType: 'Campaign', sourceId: id });
  return deleted;
};

// Upserts one platform's metrics block on a campaign without disturbing the
// others, so the tabbed metric-entry UI can save each platform independently.
exports.saveCampaignPlatformMetrics = async (id, platform, metrics) => {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');

  const existing = campaign.platformMetrics.find((pm) => pm.platform === platform);
  if (existing) {
    existing.metrics = metrics;
    existing.enteredAt = new Date();
  } else {
    campaign.platformMetrics.push({ platform, metrics, enteredAt: new Date() });
  }

  const allPlatformsEntered = campaign.platforms.every((p) =>
    campaign.platformMetrics.some((pm) => pm.platform === p)
  );
  if (allPlatformsEntered && campaign.status !== 'Completed') {
    campaign.status = 'Completed';
    campaign.metricsCompletedAt = new Date();
    // Close out any open reminders now that metrics are fully entered, so a
    // stale "launches in N days" banner doesn't linger for a finished campaign.
    await Reminder.updateMany(
      { sourceType: 'Campaign', sourceId: campaign._id, actioned: false },
      { actioned: true, actionedAt: new Date() }
    );
  }

  await campaign.save();
  return campaign;
};

exports.saveCampaignInsights = async (id, insights) => {
  const updated = await Campaign.findByIdAndUpdate(
    id,
    { insights },
    { returnDocument: 'after', runValidators: true }
  );
  if (!updated) throw new Error('Campaign not found');
  return updated;
};

exports.rescheduleCampaign = async (id, { startDate, endDate }) => {
  const updated = await Campaign.findByIdAndUpdate(
    id,
    { startDate, endDate, status: 'Planning' },
    { returnDocument: 'after', runValidators: true }
  );
  if (!updated) throw new Error('Campaign not found');
  await Reminder.deleteMany({ sourceType: 'Campaign', sourceId: id, actioned: false });
  return updated;
};

// ====================
// UNIFIED REMINDER SERVICES
// ====================

// Feeds the single notification queue shared by campaigns, events and milestones.
exports.getOpenReminders = async (filters = {}) => {
  const query = { actioned: false };
  if (filters.sourceType) query.sourceType = filters.sourceType;
  return Reminder.find(query).sort({ reminderType: 1, createdAt: -1 });
};

exports.actionReminder = async (id) => {
  const updated = await Reminder.findByIdAndUpdate(
    id,
    { actioned: true, actionedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!updated) throw new Error('Reminder not found');
  return updated;
};

// ====================
// EVENT SERVICES
// ====================

exports.getAllEvents = async (filters = {}) => {
  const query = {};
  if (filters.eventType) query.eventType = filters.eventType;
  if (filters.cancelled !== undefined) query.cancelled = filters.cancelled === 'true';
  return Event.find(query)
    .populate('linkedScript', 'title product shotType scriptFileUrl scriptFileName')
    .populate('linkedCampaign', 'campaignName platforms startDate endDate status')
    .sort({ startDate: 1 });
};

exports.getEventById = async (id) => {
  const event = await Event.findById(id)
    .populate('linkedScript', 'title product shotType scriptFileUrl scriptFileName')
    .populate('linkedCampaign', 'campaignName platforms startDate endDate status');
  if (!event) throw new Error('Event not found');
  return event;
};

exports.createEvent = async (data) => {
  return Event.create(data);
};

exports.updateEvent = async (id, data) => {
  const { _id, derivedStatus, prepProgress, ...updates } = data;
  const updated = await Event.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Event not found');
  return updated;
};

exports.deleteEvent = async (id) => {
  const deleted = await Event.findByIdAndDelete(id);
  if (!deleted) throw new Error('Event not found');
  await Reminder.deleteMany({ sourceType: 'Event', sourceId: id });
  return deleted;
};

// Targeted subdocument toggle — avoids rewriting the whole checklist array
// (and clobbering a teammate's concurrent edit) just to tick one box.
exports.toggleEventTask = async (eventId, taskId, completed) => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error('Event not found');
  const task = event.prepChecklist.id(taskId);
  if (!task) throw new Error('Prep task not found');
  task.completed = completed;
  await event.save();
  return event;
};

exports.updateEventAttendee = async (eventId, attendeeId, updates) => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error('Event not found');
  const attendee = event.attendees.id(attendeeId);
  if (!attendee) throw new Error('Attendee not found');
  Object.assign(attendee, updates);
  await event.save();
  return event;
};

exports.saveEventMetrics = async (id, { metrics, achievements }) => {
  const event = await Event.findById(id);
  if (!event) throw new Error('Event not found');
  if (metrics) event.metrics = { ...event.metrics?.toObject?.() ?? {}, ...metrics };
  if (achievements) event.achievements = achievements;
  event.metricsEnteredAt = new Date();
  await event.save();
  return event;
};

// Push a lead captured during a webinar/session straight into the prospecting
// pipeline, so BD follow-up never requires re-keying it in another module.
exports.convertEventLeadToProspect = async (eventId, leadData) => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error('Event not found');

  const lead = await ProspectingLead.create({
    ...leadData,
    opportunityStage: leadData.opportunityStage || 'Qualified',
    companyChallenge: leadData.companyChallenge || `Engaged during "${event.title}"`,
  });

  return { event, lead };
};

// ====================
// MILESTONE SERVICES
// ====================

exports.getAllMilestones = async (filters = {}) => {
  const query = {};
  if (filters.milestoneType) query.milestoneType = filters.milestoneType;
  if (filters.active !== undefined) query.active = filters.active === 'true';
  // `client` scopes the list to one account's appreciation dates; `scope=team`
  // keeps client milestones out of the team culture board.
  if (filters.client) query.client = filters.client;
  if (filters.scope === 'team') query.client = { $exists: false };
  if (filters.scope === 'client') query.client = { $exists: true };
  const milestones = await Milestone.find(query).populate('client', 'name');
  // Sorted by the virtual, so the soonest upcoming celebration leads the list.
  return milestones.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
};

exports.createMilestone = async (data) => {
  return Milestone.create(data);
};

exports.updateMilestone = async (id, data) => {
  const { _id, nextOccurrence, daysUntil, yearsCompleted, ...updates } = data;
  const updated = await Milestone.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Milestone not found');
  return updated;
};

exports.deleteMilestone = async (id) => {
  const deleted = await Milestone.findByIdAndDelete(id);
  if (!deleted) throw new Error('Milestone not found');
  await Reminder.deleteMany({ sourceType: 'Milestone', sourceId: id });
  return deleted;
};

// ====================
// DG ANNUAL EVENT SERVICES
// ====================

exports.getAllDgEvents = async () => {
  return DgEvent.find().sort({ fiscalYear: -1 });
};

exports.getDgEventById = async (id) => {
  const dgEvent = await DgEvent.findById(id);
  if (!dgEvent) throw new Error('DG event not found');
  return dgEvent;
};

exports.createDgEvent = async (data) => {
  return DgEvent.create(data);
};

exports.updateDgEvent = async (id, data) => {
  const { _id, phaseProgress, overallProgress, currentPhase, budgetRemaining, ...updates } = data;
  const updated = await DgEvent.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('DG event not found');
  return updated;
};

exports.deleteDgEvent = async (id) => {
  const deleted = await DgEvent.findByIdAndDelete(id);
  if (!deleted) throw new Error('DG event not found');
  return deleted;
};

exports.addDgPhaseTask = async (dgEventId, phaseId, task) => {
  const dgEvent = await DgEvent.findById(dgEventId);
  if (!dgEvent) throw new Error('DG event not found');
  const phase = dgEvent.phases.id(phaseId);
  if (!phase) throw new Error('Phase not found');
  phase.tasks.push(task);
  await dgEvent.save();
  return dgEvent;
};

exports.updateDgPhaseTask = async (dgEventId, phaseId, taskId, updates) => {
  const dgEvent = await DgEvent.findById(dgEventId);
  if (!dgEvent) throw new Error('DG event not found');
  const phase = dgEvent.phases.id(phaseId);
  if (!phase) throw new Error('Phase not found');
  const task = phase.tasks.id(taskId);
  if (!task) throw new Error('Task not found');
  Object.assign(task, updates);
  await dgEvent.save();
  return dgEvent;
};

exports.deleteDgPhaseTask = async (dgEventId, phaseId, taskId) => {
  const dgEvent = await DgEvent.findById(dgEventId);
  if (!dgEvent) throw new Error('DG event not found');
  const phase = dgEvent.phases.id(phaseId);
  if (!phase) throw new Error('Phase not found');
  const task = phase.tasks.id(taskId);
  if (!task) throw new Error('Task not found');
  task.deleteOne();
  await dgEvent.save();
  return dgEvent;
};

exports.submitDgProposal = async (dgEventId, proposal) => {
  const dgEvent = await DgEvent.findById(dgEventId);
  if (!dgEvent) throw new Error('DG event not found');
  dgEvent.proposals.push(proposal);
  await dgEvent.save();
  return dgEvent;
};

exports.reviewDgProposal = async (dgEventId, proposalId, { status, reviewNote }) => {
  const dgEvent = await DgEvent.findById(dgEventId);
  if (!dgEvent) throw new Error('DG event not found');
  const proposal = dgEvent.proposals.id(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (status) proposal.status = status;
  if (reviewNote !== undefined) proposal.reviewNote = reviewNote;
  await dgEvent.save();
  return dgEvent;
};

// ====================
// MEDIA HUB SERVICES
// ====================

const MEDIA_OWNERS = { Event, Milestone };

// Attach a media item (uploaded file or external link) to an event or milestone.
exports.addMediaItem = async (ownerType, ownerId, item) => {
  const Model = MEDIA_OWNERS[ownerType];
  if (!Model) throw new Error('Media can only be attached to an Event or Milestone');
  const owner = await Model.findById(ownerId);
  if (!owner) throw new Error(`${ownerType} not found`);
  if (!item?.url) throw new Error('A file or link is required');

  owner.mediaLinks.push({
    url: item.url,
    label: item.label || '',
    kind: item.kind || 'Link',
  });
  await owner.save();
  return owner;
};

exports.deleteMediaItem = async (ownerType, ownerId, mediaId) => {
  const Model = MEDIA_OWNERS[ownerType];
  if (!Model) throw new Error('Media can only be attached to an Event or Milestone');
  const owner = await Model.findById(ownerId);
  if (!owner) throw new Error(`${ownerType} not found`);
  const media = owner.mediaLinks.id(mediaId);
  if (!media) throw new Error('Media item not found');
  media.deleteOne();
  await owner.save();
  return owner;
};

// Flattened archive across both sources, newest first — powers the Media Hub panel.
exports.getMediaArchive = async () => {
  const [events, milestones] = await Promise.all([
    Event.find({ 'mediaLinks.0': { $exists: true } }).select('title mediaLinks startDate'),
    Milestone.find({ 'mediaLinks.0': { $exists: true } }).select('participantName mediaLinks milestoneMonth milestoneDay'),
  ]);

  const items = [
    ...events.flatMap((e) =>
      e.mediaLinks.map((m) => ({
        _id: m._id, url: m.url, label: m.label, kind: m.kind,
        ownerType: 'Event', ownerId: e._id, context: e.title, date: e.startDate,
      }))
    ),
    ...milestones.flatMap((ms) =>
      ms.mediaLinks.map((m) => ({
        _id: m._id, url: m.url, label: m.label, kind: m.kind,
        ownerType: 'Milestone', ownerId: ms._id, context: ms.participantName, date: null,
      }))
    ),
  ];

  return items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};
