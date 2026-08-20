// ============================================
// Email & SMS outreach.
//
// The workspace does NOT send anything — there is no provider in the stack.
// Everything here records sends made elsewhere so the team can answer: who is
// on this list, when did we last contact them, how many times, and who replied.
// ============================================

const OutreachCampaign = require('../models/OutreachCampaign');
const OutreachRecipient = require('../models/OutreachRecipient');
const ProspectingLead = require('../models/ProspectingLead');
const Client = require('../models/Client');
const Reminder = require('../models/Reminder');

const normaliseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

const clean = (value) => (typeof value === 'string' ? value.trim() : value || '');

// ====================
// CAMPAIGNS
// ====================

exports.getCampaigns = async (filters = {}) => {
  const { channel, status, owner, search, includeArchived } = filters;

  const query = {};
  if (channel) query.channel = channel;
  if (status) query.status = status;
  if (owner) query.owner = owner;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [{ name: rx }, { description: rx }, { owner: rx }, { tags: rx }];
  }

  const campaigns = await OutreachCampaign.find(query).sort({ createdAt: -1 });

  // Recipient counts in one grouped query rather than N per campaign.
  const counts = await OutreachRecipient.aggregate([
    { $match: { campaign: { $in: campaigns.map((c) => c._id) } } },
    { $group: { _id: '$campaign', total: { $sum: 1 } } },
  ]);
  const byCampaign = Object.fromEntries(counts.map((c) => [String(c._id), c.total]));

  return campaigns.map((c) => ({ ...c.toJSON(), recipientCount: byCampaign[String(c._id)] || 0 }));
};

exports.getCampaignById = async (id) => {
  const campaign = await OutreachCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  return campaign;
};

exports.createCampaign = async (data) => {
  const name = clean(data.name);
  if (!name) throw new Error('Give the campaign a name');
  if (!OutreachCampaign.CHANNELS.includes(data.channel)) {
    throw new Error('Campaign channel must be Email or SMS');
  }
  return OutreachCampaign.create({
    channel: data.channel,
    name,
    description: data.description || '',
    owner: data.owner || '',
    tags: normaliseTags(data.tags),
    status: data.status || 'Draft',
  });
};

exports.updateCampaign = async (id, data) => {
  // channel is immutable — the recipient columns and metrics depend on it.
  const { _id, batches, channel, ...updates } = data;
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);

  const updated = await OutreachCampaign.findByIdAndUpdate(id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Campaign not found');
  return updated;
};

exports.setCampaignArchived = async (id, archived) => {
  const campaign = await OutreachCampaign.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!campaign) throw new Error('Campaign not found');
  return campaign;
};

// Archive-first, matching every other module. Deleting takes the recipient list
// and its send history with it, so it is guarded behind the archive step.
exports.deleteCampaign = async (id) => {
  const campaign = await OutreachCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.archived) {
    throw new Error('Archive this campaign before deleting — the send history goes with it.');
  }
  await OutreachRecipient.deleteMany({ campaign: id });
  await Reminder.deleteMany({ sourceType: 'OutreachCampaign', sourceId: id });
  await campaign.deleteOne();
  return campaign;
};

// ====================
// RECIPIENTS
// ====================

exports.getRecipients = async (campaignId, filters = {}) => {
  const query = { campaign: campaignId };
  if (filters.status) query.currentStatus = filters.status;

  if (filters.search) {
    const safe = String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [{ name: rx }, { email: rx }, { contact: rx }, { company: rx }, { title: rx }, { notes: rx }];
  }

  return OutreachRecipient.find(query).sort({ name: 1 });
};

const buildRecipient = (campaignId, row, sourceType = 'Manual', sourceId) => ({
  campaign: campaignId,
  name: clean(row.name),
  title: clean(row.title),
  email: clean(row.email),
  contact: clean(row.contact),
  company: clean(row.company),
  notes: clean(row.notes),
  sourceType,
  sourceId,
});

// A row is only useful if we can actually reach the person on the campaign's
// channel, so the required field differs by channel.
const validateRow = (row, channel) => {
  if (!clean(row.name)) return 'name is required';
  if (channel === 'Email' && !clean(row.email)) return 'email is required';
  if (channel === 'SMS' && !clean(row.contact)) return 'phone contact is required';
  if (channel === 'Email' && clean(row.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(row.email))) {
    return 'email address looks malformed';
  }
  return null;
};

exports.addRecipient = async (campaignId, data) => {
  const campaign = await exports.getCampaignById(campaignId);
  const problem = validateRow(data, campaign.channel);
  if (problem) throw new Error(problem.charAt(0).toUpperCase() + problem.slice(1));
  return OutreachRecipient.create(buildRecipient(campaignId, data, data.sourceType || 'Manual'));
};

exports.updateRecipient = async (recipientId, data) => {
  // The grid patches one cell at a time; send history is never edited this way.
  const { _id, campaign, sends, sendCount, lastSentAt, ...updates } = data;
  if (updates.name !== undefined && !clean(updates.name)) {
    throw new Error('A recipient needs a name');
  }
  const updated = await OutreachRecipient.findByIdAndUpdate(recipientId, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!updated) throw new Error('Recipient not found');
  return updated;
};

exports.deleteRecipient = async (recipientId) => {
  const deleted = await OutreachRecipient.findByIdAndDelete(recipientId);
  if (!deleted) throw new Error('Recipient not found');
  return deleted;
};

/**
 * Bulk import from a parsed spreadsheet.
 *
 * The existing prospecting-lead importer posts straight to insertMany and lets
 * Mongo throw one flattened error for the whole file, which tells the user
 * nothing about WHICH row was wrong. This validates per row, reports row
 * numbers, and skips duplicates instead of silently doubling the list.
 */
exports.bulkAddRecipients = async (campaignId, rows) => {
  const campaign = await exports.getCampaignById(campaignId);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No rows to import');
  }

  const existing = await OutreachRecipient.find({ campaign: campaignId }).select('email contact');
  const seenEmail = new Set(existing.map((r) => r.email.toLowerCase()).filter(Boolean));
  const seenPhone = new Set(existing.map((r) => r.contact.replace(/\s+/g, '')).filter(Boolean));

  const valid = [];
  const errors = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    // +2: one for the header row, one because humans count from 1.
    const rowNumber = index + 2;

    const problem = validateRow(row, campaign.channel);
    if (problem) {
      errors.push(`Row ${rowNumber}: ${problem}`);
      return;
    }

    const email = clean(row.email).toLowerCase();
    const phone = clean(row.contact).replace(/\s+/g, '');
    // Duplicates within the file itself count too, not just against the DB.
    if ((email && seenEmail.has(email)) || (phone && seenPhone.has(phone))) {
      skipped += 1;
      return;
    }
    if (email) seenEmail.add(email);
    if (phone) seenPhone.add(phone);

    valid.push(buildRecipient(campaignId, row, 'Excel'));
  });

  const inserted = valid.length
    ? await OutreachRecipient.insertMany(valid, { ordered: false })
    : [];

  return {
    imported: inserted.length,
    skipped,
    errors,
    // Capped so a catastrophically bad file cannot return a megabyte of text.
    truncatedErrors: errors.length > 20,
    recipients: inserted,
  };
};

// Pull people already in the workspace rather than retyping them.
exports.importFromWorkspace = async (campaignId, { leadIds = [], clientIds = [] }) => {
  const campaign = await exports.getCampaignById(campaignId);
  const existing = await OutreachRecipient.find({ campaign: campaignId }).select('email contact');
  const seenEmail = new Set(existing.map((r) => r.email.toLowerCase()).filter(Boolean));
  const seenPhone = new Set(existing.map((r) => r.contact.replace(/\s+/g, '')).filter(Boolean));

  const candidates = [];

  if (leadIds.length) {
    const leads = await ProspectingLead.find({ _id: { $in: leadIds } });
    for (const lead of leads) {
      candidates.push({
        row: {
          name: lead.contactPerson,
          title: lead.position,
          email: lead.primaryEmail,
          contact: lead.primaryContact,
          company: lead.company,
        },
        sourceType: 'Prospecting Lead',
        sourceId: lead._id,
      });
    }
  }

  if (clientIds.length) {
    const clients = await Client.find({ _id: { $in: clientIds } });
    for (const client of clients) {
      // A client record holds several contacts; each becomes its own recipient.
      for (const contact of client.contacts || []) {
        candidates.push({
          row: {
            name: contact.name,
            title: contact.role,
            email: contact.email,
            contact: contact.phone,
            company: client.name,
          },
          sourceType: 'Client',
          sourceId: client._id,
        });
      }
    }
  }

  const valid = [];
  const errors = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const problem = validateRow(candidate.row, campaign.channel);
    if (problem) {
      errors.push(`${candidate.row.name || 'Unnamed contact'}: ${problem}`);
      continue;
    }
    const email = clean(candidate.row.email).toLowerCase();
    const phone = clean(candidate.row.contact).replace(/\s+/g, '');
    if ((email && seenEmail.has(email)) || (phone && seenPhone.has(phone))) {
      skipped += 1;
      continue;
    }
    if (email) seenEmail.add(email);
    if (phone) seenPhone.add(phone);
    valid.push(buildRecipient(campaignId, candidate.row, candidate.sourceType, candidate.sourceId));
  }

  const inserted = valid.length
    ? await OutreachRecipient.insertMany(valid, { ordered: false })
    : [];

  return { imported: inserted.length, skipped, errors, recipients: inserted };
};

// ====================
// BATCHES — the multi-send core
// ====================

/**
 * Record a send to the list. This is what makes "50 emails to the same person"
 * traceable: every recipient in the batch gains a `sends` entry, so the history
 * accumulates rather than each send overwriting the last.
 */
exports.logBatch = async (campaignId, data) => {
  const campaign = await exports.getCampaignById(campaignId);

  const sentAt = data.sentAt ? new Date(data.sentAt) : new Date();
  if (Number.isNaN(sentAt.getTime())) throw new Error('A send needs a valid date');

  // Default to the whole list; an explicit subset is allowed.
  const query = { campaign: campaignId };
  if (Array.isArray(data.recipientIds) && data.recipientIds.length) {
    query._id = { $in: data.recipientIds };
  }
  const recipients = await OutreachRecipient.find(query);
  if (recipients.length === 0) {
    throw new Error('This campaign has no recipients yet — add the list before logging a send.');
  }

  const batchNumber = (campaign.batches || []).reduce((max, b) => Math.max(max, b.batchNumber), 0) + 1;

  campaign.batches.push({
    batchNumber,
    subject: data.subject || '',
    body: data.body || '',
    sentAt,
    sentBy: data.sentBy || '',
    recipientCount: recipients.length,
    note: data.note || '',
  });
  await campaign.save();

  const batch = campaign.batches[campaign.batches.length - 1];

  await OutreachRecipient.updateMany(
    { _id: { $in: recipients.map((r) => r._id) } },
    {
      $push: {
        sends: { batchNumber, batchId: batch._id, sentAt, subject: data.subject || '' },
      },
      $inc: { sendCount: 1 },
      $set: { lastSentAt: sentAt },
    }
  );

  // Only nudge people out of 'Not Sent'. Someone already marked Replied stays
  // Replied — a later send does not erase the fact that they answered.
  await OutreachRecipient.updateMany(
    { _id: { $in: recipients.map((r) => r._id) }, currentStatus: 'Not Sent' },
    { $set: { currentStatus: 'Sent' } }
  );

  if (campaign.status === 'Draft') {
    campaign.status = 'Active';
    await campaign.save();
  }

  return exports.getCampaignById(campaignId);
};

exports.saveBatchMetrics = async (campaignId, batchId, metrics) => {
  const campaign = await exports.getCampaignById(campaignId);
  if (campaign.channel !== 'Email') {
    throw new Error('Only email campaigns track performance metrics');
  }
  const batch = campaign.batches.id(batchId);
  if (!batch) throw new Error('Batch not found');

  const keys = ['openedNoReplyPct', 'repliedPct', 'notOpenedPct', 'bouncedPct'];
  const values = {};
  for (const key of keys) {
    const raw = metrics[key];
    if (raw === '' || raw === null || raw === undefined) continue;
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      throw new Error(`${key} must be a percentage between 0 and 100`);
    }
    values[key] = num;
  }
  if (Object.keys(values).length === 0) {
    throw new Error('Enter at least one metric');
  }

  // These are shares of the same batch, so together they cannot exceed the
  // whole. Catching it here stops a typo becoming a nonsense roll-up.
  const total = keys.reduce((sum, key) => sum + (values[key] || 0), 0);
  if (total > 100.5) {
    throw new Error(`Those percentages add up to ${Math.round(total)}% — they cannot exceed 100%`);
  }

  batch.metrics = { ...values, enteredAt: new Date() };

  // Every batch scored and nothing left outstanding: the campaign is done.
  const allScored = campaign.batches.every((b) => b.metrics && b.metrics.enteredAt);
  if (allScored && campaign.status !== 'Completed') {
    campaign.status = 'Completed';
    await Reminder.updateMany(
      { sourceType: 'OutreachCampaign', sourceId: campaign._id, actioned: false },
      { actioned: true, actionedAt: new Date() }
    );
  }

  await campaign.save();
  return exports.getCampaignById(campaignId);
};

exports.deleteBatch = async (campaignId, batchId) => {
  const campaign = await exports.getCampaignById(campaignId);
  const batch = campaign.batches.id(batchId);
  if (!batch) throw new Error('Batch not found');

  const { batchNumber } = batch;
  batch.deleteOne();
  await campaign.save();

  // Unwind the send from every recipient, then recompute the denormalised
  // counters from what actually remains rather than decrementing blindly.
  await OutreachRecipient.updateMany(
    { campaign: campaignId },
    { $pull: { sends: { batchNumber } } }
  );
  const recipients = await OutreachRecipient.find({ campaign: campaignId });
  for (const recipient of recipients) {
    recipient.sendCount = recipient.sends.length;
    recipient.lastSentAt = recipient.sends.length
      ? recipient.sends.reduce((latest, s) => (s.sentAt > latest ? s.sentAt : latest), recipient.sends[0].sentAt)
      : null;
    if (recipient.sends.length === 0 && recipient.currentStatus === 'Sent') {
      recipient.currentStatus = 'Not Sent';
    }
    await recipient.save();
  }

  return exports.getCampaignById(campaignId);
};

// ====================
// STATS
// ====================

exports.getStats = async (channel) => {
  const query = { archived: { $ne: true } };
  if (channel) query.channel = channel;

  const campaigns = await OutreachCampaign.find(query);
  const ids = campaigns.map((c) => c._id);

  const statusCounts = await OutreachRecipient.aggregate([
    { $match: { campaign: { $in: ids } } },
    { $group: { _id: '$currentStatus', n: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));

  const totalRecipients = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const replied = byStatus.Replied || 0;
  const contacted = totalRecipients - (byStatus['Not Sent'] || 0);

  const awaitingMetrics = campaigns.reduce(
    (sum, c) => sum + c.batchesAwaitingMetrics.length,
    0
  );

  return {
    totals: {
      campaigns: campaigns.length,
      active: campaigns.filter((c) => c.status === 'Active').length,
      recipients: totalRecipients,
      contacted,
      replied,
      // A reply rate over people actually contacted, not over the whole list.
      replyRate: contacted > 0 ? Math.round((replied / contacted) * 1000) / 10 : 0,
      sends: campaigns.reduce((sum, c) => sum + c.batchCount, 0),
      awaitingMetrics,
    },
    byStatus,
  };
};
