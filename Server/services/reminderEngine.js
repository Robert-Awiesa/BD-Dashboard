const Campaign = require('../models/Campaign');
const Event = require('../models/Event');
const Milestone = require('../models/Milestone');
const Reminder = require('../models/Reminder');
const DocumentModel = require('../models/Document');
const Client = require('../models/Client');
const Interaction = require('../models/Interaction');
const OutreachCampaign = require('../models/OutreachCampaign');
const Tender = require('../models/Tender');
const Eoi = require('../models/Eoi');
const Proposal = require('../models/Proposal');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_LEAD_DAYS = 2;

const todayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const dateOnly = (value) => {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysBetween = (a, b) => Math.round((b - a) / MS_PER_DAY);

const upsertReminder = async (payload) => {
  const { sourceType, sourceId, reminderDate } = payload;
  return Reminder.findOneAndUpdate(
    { sourceType, sourceId, reminderDate },
    payload,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

// --- Campaigns: warn before launch, escalate once the window has passed ---
async function evaluateCampaigns(today, todayKey, results) {
  const campaigns = await Campaign.find({ status: { $ne: 'Completed' } });

  for (const campaign of campaigns) {
    const startOnly = dateOnly(campaign.startDate);
    const endOnly = dateOnly(campaign.endDate);
    const daysToStart = daysBetween(today, startOnly);
    const daysPastEnd = daysBetween(endOnly, today);

    let reminderType = null;
    if (daysPastEnd > 0) reminderType = 'overdue';
    else if (daysToStart >= 0 && daysToStart <= REMINDER_LEAD_DAYS) reminderType = 'upcoming';
    if (!reminderType) continue;

    if (reminderType === 'overdue' && campaign.status !== 'Reschedule Needed') {
      campaign.status = 'Reschedule Needed';
      await campaign.save();
    }

    const platforms = campaign.platforms?.join(', ') || 'no platforms set';
    const message = reminderType === 'overdue'
      ? `"${campaign.campaignName}" ended ${daysPastEnd} day(s) ago with no completed metrics. Reschedule or close it out. Platforms: ${platforms}.`
      : `"${campaign.campaignName}" launches in ${daysToStart} day(s) on ${toDateKey(startOnly)}. Platforms: ${platforms}.`;

    results.push(await upsertReminder({
      sourceType: 'Campaign',
      sourceId: campaign._id,
      sourceLabel: campaign.campaignName,
      reminderDate: todayKey,
      reminderType,
      message,
      responsiblePerson: campaign.responsiblePerson,
    }));
  }
}

// --- Events: warn 2 days ahead, and flag prep tasks still open on the day ---
async function evaluateEvents(today, todayKey, results) {
  const events = await Event.find({ cancelled: false });

  for (const event of events) {
    const startOnly = dateOnly(event.startDate);
    const daysToStart = daysBetween(today, startOnly);
    if (daysToStart < 0 || daysToStart > REMINDER_LEAD_DAYS) continue;

    const openTasks = (event.prepChecklist || []).filter((t) => !t.completed).length;
    const when = daysToStart === 0 ? 'today' : `in ${daysToStart} day(s)`;
    const where = event.modality === 'Physical'
      ? event.locationDetails || 'venue TBC'
      : event.modality;

    let message = `${event.eventType} "${event.title}" runs ${when} (${when === 'today' ? '' : toDateKey(startOnly) + ', '}${where}).`;
    if (openTasks > 0) {
      message += ` ${openTasks} prep task(s) still open.`;
    }

    results.push(await upsertReminder({
      sourceType: 'Event',
      sourceId: event._id,
      sourceLabel: event.title,
      reminderDate: todayKey,
      reminderType: daysToStart === 0 ? 'today' : 'upcoming',
      message,
      responsiblePerson: event.assignedLead,
      link: event.locationDetails,
    }));
  }
}

// --- Milestones: recurring birthdays / anniversaries, 2 days of lead time ---
// A team member record carries two dates — a birthday and a work anniversary —
// and the Reminder collection holds at most one row per (source, day). So when
// both land in the window they become one combined message, the same way a
// client with several problems does, rather than one silently overwriting
// the other.
async function evaluateMilestones(today, todayKey, results) {
  const milestones = await Milestone.find({ active: true, isDraft: { $ne: true } })
    .populate('client', 'name accountOwner');

  for (const milestone of milestones) {
    const who = milestone.departmentOrCompany
      ? `${milestone.participantName} (${milestone.departmentOrCompany})`
      : milestone.participantName;

    const due = milestone.occurrences.filter(
      (o) => o.daysUntil !== null && o.daysUntil >= 0 && o.daysUntil <= REMINDER_LEAD_DAYS
    );
    if (due.length === 0) continue;

    const parts = due.map((o) => {
      const when = o.daysUntil === 0 ? 'today' : `in ${o.daysUntil} day(s)`;

      if (o.kind === 'Birthday') {
        if (milestone.milestoneType === 'Client Contact Birthday') {
          const account = milestone.client?.name || milestone.departmentOrCompany;
          return `🎂 ${milestone.participantName}${account ? ` (${account})` : ''} has a birthday ${when}`;
        }
        return `🎂 ${who}'s birthday is ${when}`;
      }

      if (milestone.milestoneType === 'Client Anniversary') {
        return `🤝 ${milestone.participantName} reaches ${o.years ? `${o.years} year(s)` : 'an anniversary'} with us ${when} — worth a note`;
      }
      if (milestone.milestoneType === 'Partner Milestone') {
        return `🤝 Partner milestone ${when}: ${who}${o.years ? ` — ${o.years} year(s)` : ''}`;
      }
      return `🎉 ${who} celebrates ${o.years ? `their ${o.years}-year` : 'a'} work anniversary ${when}`;
    });

    const soonest = Math.min(...due.map((o) => o.daysUntil));

    results.push(await upsertReminder({
      sourceType: 'Milestone',
      sourceId: milestone._id,
      sourceLabel: milestone.participantName,
      reminderDate: todayKey,
      reminderType: soonest === 0 ? 'today' : 'upcoming',
      message: `${parts.join('; ')}.`,
      responsiblePerson: milestone.client?.accountOwner || milestone.departmentOrCompany,
    }));
  }
}

// --- Clients: chase the relationship, not just the calendar ---
// The Reminder collection holds at most one row per (source, day), so a client
// with several live problems produces ONE combined nudge rather than three
// competing ones. That is also kinder to the feed.
//
// Nagging cadence matters as much as detection: a neglected account stays
// neglected until someone acts, so an unconditional daily reminder would bury
// everything else within a week. Overdue states therefore repeat weekly, while
// dated events (renewals, due commitments) fire on a fixed countdown.
const RENEWAL_COUNTDOWN_DAYS = [60, 30, 14, 7, 3, 1, 0];

async function evaluateClients(today, todayKey, results) {
  const clients = await Client.find({
    archived: { $ne: true },
    status: { $nin: ['Churned', 'Dormant'] },
  });

  for (const client of clients) {
    const notes = [];
    let severity = 'upcoming';

    // 1. Gone quiet, relative to this client's agreed cadence.
    const cadence = client.expectedCadenceDays;
    // A client nobody has ever contacted has no "days since" at all, and the
    // comparison below skipped it — so the one account with nothing recorded
    // against it was the only one never chased. Count from when it was added.
    const since = client.daysSinceLastContact !== null
      ? client.daysSinceLastContact
      : daysBetween(client.createdAt, today);
    const neverContacted = client.daysSinceLastContact === null;

    if (since !== null && since > cadence) {
      // Fire on the day it lapses, then weekly — not on day 7 only, which would
      // leave the first week of neglect completely silent.
      const overdueBy = since - cadence;
      if (overdueBy === 1 || overdueBy % 7 === 0) {
        notes.push(neverContacted
          ? `no contact has ever been logged, ${since} days after it was added (cadence is ${cadence})`
          : `no contact for ${since} days (cadence is ${cadence})`);
        severity = 'overdue';
      }
    }

    // 2. Promises we made.
    for (const commitment of client.commitments || []) {
      if (commitment.completed || !commitment.dueDate) continue;
      const due = dateOnly(commitment.dueDate);
      const daysToDue = daysBetween(today, due);
      if (daysToDue === 0) {
        notes.push(`"${commitment.description}" is due today`);
        if (severity !== 'overdue') severity = 'today';
      } else if (daysToDue > 0 && daysToDue <= REMINDER_LEAD_DAYS) {
        notes.push(`"${commitment.description}" is due in ${daysToDue} day(s)`);
      } else if (daysToDue < 0) {
        const overdueBy = -daysToDue;
        if (overdueBy % 7 === 0) {
          notes.push(`"${commitment.description}" is ${overdueBy} day(s) overdue`);
          severity = 'overdue';
        }
      }
    }

    // 3. Renewal runway.
    const toRenewal = client.daysToRenewal;
    if (toRenewal !== null) {
      if (toRenewal >= 0 && RENEWAL_COUNTDOWN_DAYS.includes(toRenewal)) {
        notes.push(
          toRenewal === 0
            ? 'the contract renews today'
            : `the contract renews in ${toRenewal} day(s)`
        );
        if (toRenewal === 0 && severity !== 'overdue') severity = 'today';
      } else if (toRenewal < 0) {
        const lapsedBy = -toRenewal;
        if (lapsedBy % 7 === 0) {
          notes.push(`the renewal date passed ${lapsedBy} day(s) ago`);
          severity = 'overdue';
        }
      }
    }

    if (notes.length === 0) continue;

    results.push(await upsertReminder({
      sourceType: 'Client',
      sourceId: client._id,
      sourceLabel: client.name,
      reminderDate: todayKey,
      reminderType: severity,
      message: `${client.name} (${client.tier}) — ${notes.join('; ')}.`,
      // The account owner is on the hook; unowned accounts still surface, they
      // just have nobody named against them.
      responsiblePerson: client.accountOwner,
    }));
  }
}

// --- Documents: nudge the uploader when a document reaches its review date ---
// A stale document stays stale until someone acts, so an unconditional daily
// overdue reminder would bury the rest of the feed within a week. Instead the
// uploader is nudged on the day it lapses and then once a week after that,
// until they publish a new version or archive it.
async function evaluateDocuments(today, todayKey, results) {
  const documents = await DocumentModel.find({
    archived: { $ne: true },
    reviewDate: { $ne: null, $exists: true },
  });

  for (const doc of documents) {
    const reviewOnly = dateOnly(doc.reviewDate);
    const daysToReview = daysBetween(today, reviewOnly);
    const daysPastReview = -daysToReview;

    let reminderType = null;
    if (daysPastReview > 0) {
      if (daysPastReview % 7 !== 0) continue; // weekly cadence once lapsed
      reminderType = 'overdue';
    } else if (daysToReview === 0) {
      reminderType = 'today';
    } else if (daysToReview <= REMINDER_LEAD_DAYS) {
      reminderType = 'upcoming';
    }
    if (!reminderType) continue;

    const label = `${doc.category} — "${doc.title}" (v${doc.version})`;
    const message = reminderType === 'overdue'
      ? `${label} passed its review date ${daysPastReview} day(s) ago and is flagged Review Needed. Upload a new version or archive it.`
      : reminderType === 'today'
        ? `${label} is due for review today. Confirm it is still current, upload a new version, or archive it.`
        : `${label} is due for review in ${daysToReview} day(s) on ${toDateKey(reviewOnly)}.`;

    results.push(await upsertReminder({
      sourceType: 'Document',
      sourceId: doc._id,
      sourceLabel: doc.title,
      reminderDate: todayKey,
      reminderType,
      message,
      // The original uploader owns the refresh, per the lifecycle spec.
      responsiblePerson: doc.uploadedBy,
      link: doc.fileUrl,
    }));
  }
}

// --- Field visits: remind before the trip, and chase the write-up after ---
// The module's core failure mode is a visit that happened and never got written
// up: the trip cost a day, and the knowledge stays in one person's head. So the
// unwritten report is chased weekly until it lands.
async function evaluateFieldVisits(today, todayKey, results) {
  const visits = await Interaction.find({
    type: 'Site Visit',
    visitStatus: { $in: ['Planned', 'Completed'] },
  }).populate('client', 'name accountOwner');

  for (const visit of visits) {
    const visitDay = dateOnly(visit.occurredAt);
    const daysAway = daysBetween(today, visitDay);
    const clientName = visit.client?.name || 'a client';
    const where = visit.locationName || 'site TBC';

    let reminderType = null;
    let message = null;

    if (visit.visitStatus === 'Planned') {
      if (daysAway >= 0 && daysAway <= REMINDER_LEAD_DAYS) {
        reminderType = daysAway === 0 ? 'today' : 'upcoming';
        const when = daysAway === 0 ? 'today' : `in ${daysAway} day(s)`;
        message = `Site visit to ${clientName} (${where}) ${when}.${visit.purpose ? ` Purpose: ${visit.purpose}.` : ''}`;
      } else if (daysAway < 0) {
        // The planned date came and went with nobody marking it either way.
        const lapsedBy = -daysAway;
        if (lapsedBy === 1 || lapsedBy % 7 === 0) {
          reminderType = 'overdue';
          message = `Planned visit to ${clientName} (${where}) was ${lapsedBy} day(s) ago and is still marked Planned. Complete it or cancel it.`;
        }
      }
    } else if (visit.awaitingReport) {
      // Deliberately more insistent than the weekly cadence used elsewhere:
      // what someone noticed on site fades in days, not weeks, so the first
      // three days are chased daily before dropping back to weekly.
      const sinceVisit = -daysAway;
      if (sinceVisit >= 1 && (sinceVisit <= 3 || sinceVisit % 7 === 0)) {
        reminderType = 'overdue';
        message = `Visit to ${clientName} (${where}) on ${toDateKey(visitDay)} still has no write-up. Add the observations while they are fresh.`;
      }
    }

    if (!reminderType) continue;

    results.push(await upsertReminder({
      sourceType: 'Interaction',
      sourceId: visit._id,
      sourceLabel: `${clientName} — ${where}`,
      reminderDate: todayKey,
      reminderType,
      message,
      // Whoever booked the trip owns it; the account owner is the fallback.
      responsiblePerson: visit.loggedBy || visit.client?.accountOwner || '',
      link: visit.address,
    }));
  }
}

// --- Proposals: a submission deadline is absolute, and silence kills bids ---
// One combined reminder per proposal per day, same as clients — the unique
// index allows only one row, and three competing nudges about the same bid
// would be worse than one that says everything.
const PROPOSAL_COUNTDOWN_DAYS = [14, 7, 3, 1, 0];

async function evaluateProposals(today, todayKey, results) {
  const proposals = await Proposal.find({
    archived: { $ne: true },
    stage: { $nin: Proposal.CLOSED_STAGES },
  }).populate('client', 'name');

  for (const proposal of proposals) {
    const notes = [];
    let severity = 'upcoming';
    const who = proposal.client?.name || proposal.prospectName || 'the client';

    // 1. The deadline. Unlike a review date, missing it ends the opportunity,
    // so this counts down rather than nagging weekly.
    const toDeadline = proposal.daysToDeadline;
    if (toDeadline !== null) {
      if (toDeadline >= 0 && PROPOSAL_COUNTDOWN_DAYS.includes(toDeadline)) {
        const open = proposal.openChecklistItems;
        notes.push(
          toDeadline === 0
            ? `submission is due TODAY${open ? ` with ${open} item(s) still open` : ''}`
            : `submission is due in ${toDeadline} day(s)${open ? ` with ${open} item(s) still open` : ''}`
        );
        severity = toDeadline === 0 ? 'today' : 'upcoming';
      } else if (toDeadline < 0) {
        // Loudest state in the module: the window to bid is closing or closed,
        // and unlike a stale document this cannot be fixed later. Daily for the
        // first three days, then weekly if it is still sitting there.
        const lateBy = -toDeadline;
        if (lateBy <= 3 || lateBy % 7 === 0) {
          notes.push(`the deadline passed ${lateBy} day(s) ago and it is still not submitted`);
          severity = 'overdue';
        }
      }
    }

    // 2. Silence after submission — measured from the last follow-up, so
    // chasing genuinely resets it.
    if (proposal.isCold) {
      const silent = proposal.daysSinceContact;
      if (silent === Proposal.COLD_AFTER_DAYS || silent % 7 === 0) {
        notes.push(`no response for ${silent} days since the last contact — chase it`);
        severity = 'overdue';
      }
    }

    // 3. A decision date that has come and gone.
    const toDecision = proposal.daysToDecision;
    if (toDecision !== null && toDecision < 0) {
      const lateBy = -toDecision;
      if (lateBy === 1 || lateBy % 7 === 0) {
        notes.push(`the decision was expected ${lateBy} day(s) ago`);
        severity = 'overdue';
      }
    }

    if (notes.length === 0) continue;

    results.push(await upsertReminder({
      sourceType: 'Proposal',
      sourceId: proposal._id,
      sourceLabel: proposal.title,
      reminderDate: todayKey,
      reminderType: severity,
      message: `"${proposal.title}" (${who}, ${proposal.stage}) — ${notes.join('; ')}.`,
      responsiblePerson: proposal.owner,
    }));
  }
}

// --- Email outreach: chase the numbers nobody went back for ---
// A batch's metrics are read off Mailchimp a few days later, which is exactly
// the kind of task that gets forgotten once the send itself is done. SMS raises
// nothing here — it has no metrics by design.
async function evaluateOutreach(today, todayKey, results) {
  const campaigns = await OutreachCampaign.find({
    channel: 'Email',
    archived: { $ne: true },
  });

  for (const campaign of campaigns) {
    const pending = campaign.batchesAwaitingMetrics;
    if (pending.length === 0) continue;

    // Weekly after the grace period, so an ignored campaign does not shout
    // every morning. Oldest outstanding batch sets the cadence.
    const oldest = pending.reduce((a, b) => (a.sentAt < b.sentAt ? a : b));
    const daysSince = daysBetween(dateOnly(oldest.sentAt), today);
    const daysOverdue = daysSince - OutreachCampaign.METRICS_GRACE_DAYS;
    if (daysOverdue < 0) continue;
    if (daysOverdue !== 0 && daysOverdue % 7 !== 0) continue;

    const label = pending.length === 1
      ? `Send #${oldest.batchNumber}`
      : `${pending.length} sends`;

    results.push(await upsertReminder({
      sourceType: 'OutreachCampaign',
      sourceId: campaign._id,
      sourceLabel: campaign.name,
      reminderDate: todayKey,
      reminderType: 'overdue',
      message: `"${campaign.name}" — ${label} still has no performance figures. `
        + `Send #${oldest.batchNumber} went out ${daysSince} day(s) ago to `
        + `${oldest.recipientCount} recipient(s); read the open and reply rates off your email tool and enter them.`,
      responsiblePerson: campaign.owner,
    }));
  }
}


// --- Tenders & EOIs: the deadlines that cost real money when missed ---
// Until now this was the ONLY module built around hard external deadlines that
// never fed the reminder queue. A tender deadline is immovable — miss it and
// the opportunity is simply gone — so it gets a fixed countdown rather than the
// gentler weekly cadence used for internal housekeeping.
const TENDER_COUNTDOWN_DAYS = [30, 14, 7, 3, 2, 1, 0];

async function evaluateTenders(today, todayKey, results) {
  const tenders = await Tender.find({ archived: { $ne: true } });

  for (const tender of tenders) {
    // Submitted, won, lost, no-bid: the clock stops mattering.
    if (tender.isClosed || tender.isSubmitted) continue;

    const notes = [];
    let severity = 'upcoming';

    const days = tender.daysToDeadline;
    if (days !== null) {
      if (days >= 0 && TENDER_COUNTDOWN_DAYS.includes(days)) {
        notes.push(days === 0
          ? 'the deadline is TODAY'
          : `the deadline is in ${days} day(s) (${toDateKey(dateOnly(tender.deadline))})`);
        if (days === 0) severity = 'today';
      } else if (days < 0) {
        // Missed. Keep saying so weekly until somebody closes it out as
        // No Bid or Withdrawn, because a silently missed tender is the exact
        // failure this module exists to prevent.
        const lapsed = -days;
        if (lapsed === 1 || lapsed % 7 === 0) {
          notes.push(`the deadline passed ${lapsed} day(s) ago and it is still "${tender.status}" — submit, or close it as No Bid`);
          severity = 'overdue';
        }
      }
    }

    // Preparation milestones due before the bid goes in.
    for (const milestone of tender.pdp?.milestones || []) {
      if (milestone.done || !milestone.date) continue;
      const due = dateOnly(milestone.date);
      const toDue = daysBetween(today, due);
      if (toDue === 0) {
        notes.push(`prep milestone "${milestone.label}" is due today`);
        if (severity !== 'overdue') severity = 'today';
      } else if (toDue > 0 && toDue <= REMINDER_LEAD_DAYS) {
        notes.push(`prep milestone "${milestone.label}" is due in ${toDue} day(s)`);
      } else if (toDue < 0 && (-toDue) % 7 === 0) {
        notes.push(`prep milestone "${milestone.label}" is ${-toDue} day(s) overdue`);
        severity = 'overdue';
      }
    }

    if (notes.length === 0) continue;

    results.push(await upsertReminder({
      sourceType: 'Tender',
      sourceId: tender._id,
      sourceLabel: tender.title,
      reminderDate: todayKey,
      reminderType: severity,
      message: `${tender.title}${tender.issuingAuthority ? ` (${tender.issuingAuthority})` : ''} — ${notes.join('; ')}.`,
      responsiblePerson: tender.owner,
    }));
  }
}

// --- EOIs: an undecided notice with the clock running out ---
async function evaluateEois(today, todayKey, results) {
  const eois = await Eoi.find({ archived: { $ne: true } });

  for (const eoi of eois) {
    // Converted, passed on, or closed: already decided.
    if (eoi.convertedToTender || eoi.decision === 'Pass' || eoi.status === 'Closed') continue;

    const days = eoi.daysToDeadline;
    if (days === null) continue;

    let reminderType = null;
    let message = null;

    if (days >= 0 && TENDER_COUNTDOWN_DAYS.includes(days)) {
      reminderType = days === 0 ? 'today' : 'upcoming';
      const when = days === 0 ? 'closes TODAY' : `closes in ${days} day(s)`;
      message = eoi.decision === 'Undecided'
        ? `EOI "${eoi.title}" ${when} and nobody has decided whether to pursue it.`
        : `EOI "${eoi.title}" ${when}.`;
    } else if (days < 0) {
      const lapsed = -days;
      if (lapsed === 1 || lapsed % 7 === 0) {
        reminderType = 'overdue';
        message = `EOI "${eoi.title}" closed ${lapsed} day(s) ago while still undecided. Record a Pass with a reason, or archive it.`;
      }
    }

    if (!reminderType) continue;

    results.push(await upsertReminder({
      sourceType: 'Eoi',
      sourceId: eoi._id,
      sourceLabel: eoi.title,
      reminderDate: todayKey,
      reminderType,
      message,
      responsiblePerson: eoi.owner,
    }));
  }
}

// Safe to call repeatedly — the unique (sourceType, sourceId, reminderDate)
// index makes each source produce at most one reminder per day.
async function evaluateReminders() {
  const today = todayDateOnly();
  const todayKey = toDateKey(today);
  const results = [];

  await evaluateCampaigns(today, todayKey, results);
  await evaluateEvents(today, todayKey, results);
  await evaluateMilestones(today, todayKey, results);
  await evaluateDocuments(today, todayKey, results);
  await evaluateClients(today, todayKey, results);
  await evaluateFieldVisits(today, todayKey, results);
  await evaluateProposals(today, todayKey, results);
  await evaluateOutreach(today, todayKey, results);
  await evaluateTenders(today, todayKey, results);
  await evaluateEois(today, todayKey, results);

  return results;
}

module.exports = { evaluateReminders, REMINDER_LEAD_DAYS };
