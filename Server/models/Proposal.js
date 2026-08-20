const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// NOTE: not to be confused with DgEvent.proposals[], which are internal
// session/budget ideas submitted by staff for the annual event. This model is
// client-facing bids — what we send out to win work.

// How the opportunity arrived. Drives very different work: an RFP has a fixed
// deadline and a scoring matrix; an unsolicited pitch has neither.
const ORIGINS = [
  'RFP / Requested',
  'Tender / EOI',
  'Unsolicited Pitch',
  'Renewal',
  'Expansion',
];

// A real funnel, replacing the Active/Cold/Ongoing labels on the old page.
// "Cold" is deliberately absent — see `coldDays` below.
const STAGES = [
  'Drafting',
  'Internal Review',
  'Submitted',
  'Client Review',
  'Shortlisted',
  'Won',
  'Lost',
  'Withdrawn',
];

const CLOSED_STAGES = ['Won', 'Lost', 'Withdrawn'];

// Stage implies likelihood, so the weighted forecast needs no separate guess
// field that nobody would keep current.
const STAGE_PROBABILITY = {
  Drafting: 0.1,
  'Internal Review': 0.2,
  Submitted: 0.4,
  'Client Review': 0.5,
  Shortlisted: 0.7,
  Won: 1,
  Lost: 0,
  Withdrawn: 0,
};

// The field that pays for this whole module. Without a structured reason,
// "we lose a lot" never becomes "we lose on price in Healthcare".
const LOSS_REASONS = [
  'Price',
  'Timing',
  'Incumbent / existing supplier',
  'Missing capability',
  'No decision / budget pulled',
  'Compliance / requirements',
  'Relationship',
  'Other',
];

// Submitted and silent for this long counts as cold. Not a status someone sets
// — a condition the record falls into on its own.
const COLD_AFTER_DAYS = 14;
const DEADLINE_HORIZON_DAYS = 14;

const checklistSchema = new mongoose.Schema(
  {
    taskName: { type: String, required: true },
    assignedTo: { type: String, default: '' },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

const followUpSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    by: { type: String, default: '' },
    note: { type: String, default: '' },
    response: { type: String, default: '' },
  },
  { _id: true }
);

const proposalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    reference: { type: String, default: '' },
    origin: { type: String, enum: ORIGINS, default: 'RFP / Requested' },
    stage: { type: String, enum: STAGES, default: 'Drafting' },

    // Who it is for. A proposal often predates any client record, so a plain
    // name is accepted and the ref is optional.
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    prospectName: { type: String, default: '' },
    sector: { type: String, default: '' },
    contactName: { type: String, default: '' },

    owner: { type: String, default: '' }, // bid lead
    contributors: [{ type: String }],

    value: { type: Number, default: 0 },

    issuedDate: { type: Date },           // RFP received / decision to pitch
    submissionDeadline: { type: Date },   // absolute — miss it and it is gone
    submittedDate: { type: Date },
    decisionExpected: { type: Date },
    decidedDate: { type: Date },

    // --- Outcome ---
    lossReason: { type: String, enum: LOSS_REASONS },
    outcomeNote: { type: String, default: '' },
    competitor: { type: String, default: '' },

    // --- Links: reuse, never duplicate ---
    // The document itself lives in Reports & Docs; the case studies live in
    // Blog & Content. This module points at them rather than holding copies.
    proposalDoc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    caseStudies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    linkedTender: { type: mongoose.Schema.Types.ObjectId, ref: 'Tender' },
    linkedPipelineItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline' },

    checklist: [checklistSchema],
    followUps: [followUpSchema],

    tags: [{ type: String }],
    notes: { type: String, default: '' },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const calendarDaysBetween = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()) -
      new Date(a.getFullYear(), a.getMonth(), a.getDate())) / MS_PER_DAY
  );
};

proposalSchema.virtual('isClosed').get(function () {
  return CLOSED_STAGES.includes(this.stage);
});

proposalSchema.virtual('daysToDeadline').get(function () {
  if (!this.submissionDeadline || this.submittedDate || this.isClosed) return null;
  return calendarDaysBetween(startOfToday(), this.submissionDeadline);
});

proposalSchema.virtual('daysSinceSubmitted').get(function () {
  if (!this.submittedDate || this.isClosed) return null;
  return calendarDaysBetween(this.submittedDate, startOfToday());
});

// Days of silence: measured from the last follow-up if there is one, otherwise
// from submission. Chasing resets the clock, which is the behaviour we want.
proposalSchema.virtual('daysSinceContact').get(function () {
  if (!this.submittedDate || this.isClosed) return null;
  const lastFollowUp = (this.followUps || [])
    .map((f) => new Date(f.date))
    .sort((a, b) => b - a)[0];
  return calendarDaysBetween(lastFollowUp || this.submittedDate, startOfToday());
});

proposalSchema.virtual('isCold').get(function () {
  const silent = this.daysSinceContact;
  return silent !== null && silent >= COLD_AFTER_DAYS;
});

proposalSchema.virtual('winProbability').get(function () {
  return STAGE_PROBABILITY[this.stage] ?? 0;
});

proposalSchema.virtual('weightedValue').get(function () {
  return Math.round((this.value || 0) * this.winProbability);
});

proposalSchema.virtual('openChecklistItems').get(function () {
  return (this.checklist || []).filter((c) => !c.completed).length;
});

proposalSchema.virtual('daysToDecision').get(function () {
  if (!this.decisionExpected || this.isClosed) return null;
  return calendarDaysBetween(startOfToday(), this.decisionExpected);
});

// Same explicit-reasons approach as the client health engine: a rep can act on
// "deadline in 2 days with 4 items open" in a way no single score allows.
proposalSchema.virtual('attentionReasons').get(function () {
  if (this.archived || this.isClosed) return [];
  const reasons = [];

  const toDeadline = this.daysToDeadline;
  if (toDeadline !== null) {
    if (toDeadline < 0) {
      reasons.push({
        code: 'deadline-missed',
        label: 'Deadline passed, not submitted',
        severity: 'Critical',
        detail: `Submission was due ${Math.abs(toDeadline)} day(s) ago.`,
      });
    } else if (toDeadline <= DEADLINE_HORIZON_DAYS) {
      const open = this.openChecklistItems;
      reasons.push({
        code: 'deadline-near',
        label: 'Deadline approaching',
        severity: toDeadline <= 3 ? 'Critical' : toDeadline <= 7 ? 'At Risk' : 'Watch',
        detail: `Due in ${toDeadline} day(s)${open ? ` with ${open} item(s) still open` : ''}.`,
      });
    }
  }

  if (this.isCold) {
    reasons.push({
      code: 'gone-cold',
      label: 'Gone cold',
      severity: this.daysSinceContact >= COLD_AFTER_DAYS * 2 ? 'Critical' : 'At Risk',
      detail: `${this.daysSinceContact} days with no response or follow-up.`,
    });
  }

  const toDecision = this.daysToDecision;
  if (toDecision !== null && toDecision < 0) {
    reasons.push({
      code: 'decision-overdue',
      label: 'Decision overdue',
      severity: 'At Risk',
      detail: `Expected ${Math.abs(toDecision)} day(s) ago. Chase it.`,
    });
  }

  return reasons;
});

// Validation lives here so it holds for any caller, not just the form.
proposalSchema.pre('validate', function requireOutcomeDetail() {
  if (this.stage === 'Lost' && !this.lossReason) {
    this.invalidate(
      'lossReason',
      'Record why it was lost — an unexplained loss teaches the team nothing'
    );
  }
  if (CLOSED_STAGES.includes(this.stage) && !this.decidedDate) {
    this.decidedDate = new Date();
  }
  if (['Submitted', 'Client Review', 'Shortlisted'].includes(this.stage) && !this.submittedDate) {
    this.submittedDate = new Date();
  }
});

proposalSchema.index({ stage: 1, archived: 1, submissionDeadline: 1 });
proposalSchema.index({ owner: 1 });

proposalSchema.statics.ORIGINS = ORIGINS;
proposalSchema.statics.STAGES = STAGES;
proposalSchema.statics.CLOSED_STAGES = CLOSED_STAGES;
proposalSchema.statics.LOSS_REASONS = LOSS_REASONS;
proposalSchema.statics.STAGE_PROBABILITY = STAGE_PROBABILITY;
proposalSchema.statics.COLD_AFTER_DAYS = COLD_AFTER_DAYS;

module.exports = mongoose.model('Proposal', proposalSchema);
