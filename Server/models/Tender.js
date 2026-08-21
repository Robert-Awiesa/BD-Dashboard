const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A tender is an opportunity with a hard external deadline. Miss it and the
// opportunity is simply gone — which is why every date here is a real Date and
// why the deadline drives both a computed status and the reminder sweep.
//
// Division of labour with the Proposals module: a Tender is the OPPORTUNITY and
// the work of preparing a bid. A Proposal is the BID ITSELF and its win/loss
// record. Proposal.linkedTender joins them; neither copies the other.
const TENDER_TYPES = ['Stage One', 'Stage Two', 'Single Stage', 'Framework'];

const TENDER_STATUSES = [
  'Open',          // spotted, not yet being worked
  'In Progress',   // actively preparing the bid
  'Submitted',
  'Won',
  'Lost',
  'No Bid',        // deliberate decision not to pursue
  'Withdrawn',
];

// Once here, the clock no longer matters and the tender stops being chased.
const CLOSED_STATUSES = ['Won', 'Lost', 'No Bid', 'Withdrawn'];
const SUBMITTED_STATUSES = ['Submitted', 'Won', 'Lost'];

const SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Referral', 'Other'];

// Deadline pressure, derived from the clock rather than typed by anyone.
const CLOSING_SOON_DAYS = 7;
const UPCOMING_DAYS = 30;

const individualSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    responsibility: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    // Was a String. A milestone you cannot sort or count down to is a note,
    // not a milestone.
    date: { type: Date },
    owner: { type: String, default: '' },
    done: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { _id: true }
);

// Pre-submission delivery planning: what we would actually do if we won.
const pdpSchema = new mongoose.Schema(
  {
    objectives: { type: String, default: '' },
    milestones: [milestoneSchema],
    individuals: [individualSchema],
    // Kept for plans with no milestones; otherwise progress is computed.
    progress: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

// Financial planning for the bid.
const fdpSchema = new mongoose.Schema(
  {
    currency: { type: String, default: '' },
    estimatedCost: { type: Number, default: 0 },
    proposedPrice: { type: Number, default: 0 },
    marginPct: { type: Number, default: 0 },
    pricingModel: { type: String, default: '' },
    assumptions: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    reference: { type: String, default: '' },

    // `source` stays one of the fixed options and `sourceDetail` preserves the
    // literal typed source when it is "Other", so reporting stays clean.
    source: { type: String, enum: SOURCES, default: 'Other' },
    sourceDetail: { type: String, default: '' },
    issuingAuthority: { type: String, default: '' },
    sector: { type: String, default: '' },

    tenderType: { type: String, enum: TENDER_TYPES, default: 'Single Stage' },

    // Real dates. Previously strings, which made sorting, countdowns and any
    // kind of automated deadline warning impossible.
    deadline: { type: Date },
    submittedAt: { type: Date },
    decidedAt: { type: Date },

    // Enum is enforced now. It used to be a free-text String with the allowed
    // values declared as statics that nothing ever checked against.
    status: { type: String, enum: TENDER_STATUSES, default: 'Open' },

    // The blueprint calls for a named accountable person. Without one, a
    // deadline reminder has nobody to address.
    owner: { type: String, default: '' },

    estimatedValue: { type: Number, default: 0 },
    currency: { type: String, default: '' },

    pdp: { type: pdpSchema, default: () => ({ milestones: [], individuals: [], progress: 0 }) },
    fdp: { type: fdpSchema, default: () => ({}) },

    // Provenance when this tender began life as an EOI we decided to pursue.
    sourceEoi: { type: mongoose.Schema.Types.ObjectId, ref: 'Eoi' },

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

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dOnly - startOfToday()) / MS_PER_DAY);
};

tenderSchema.virtual('daysToDeadline').get(function () {
  return daysUntil(this.deadline);
});

tenderSchema.virtual('isClosed').get(function () {
  return CLOSED_STATUSES.includes(this.status);
});

tenderSchema.virtual('isSubmitted').get(function () {
  return SUBMITTED_STATUSES.includes(this.status);
});

/**
 * The automated status tag the blueprint asks for — derived from the clock,
 * never typed. `status` records the human decision; this records the pressure.
 */
tenderSchema.virtual('deadlineStatus').get(function () {
  if (this.archived) return 'Archived';
  if (this.isClosed || this.isSubmitted) return 'Decided';
  const days = this.daysToDeadline;
  if (days === null) return 'No Deadline';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due Today';
  if (days <= CLOSING_SOON_DAYS) return 'Closing Soon';
  if (days <= UPCOMING_DAYS) return 'Upcoming';
  return 'Scheduled';
});

// The expensive failure: the deadline came and went while it was still open.
// Distinguished from a deliberate No Bid, which is a decision, not a miss.
tenderSchema.virtual('isMissed').get(function () {
  if (this.archived || this.isClosed || this.isSubmitted) return false;
  const days = this.daysToDeadline;
  return days !== null && days < 0;
});

// Progress reads from the milestones when there are any, because a stored
// percentage and a checklist inevitably disagree.
tenderSchema.virtual('pdpProgress').get(function () {
  const milestones = this.pdp?.milestones || [];
  if (milestones.length === 0) return this.pdp?.progress || 0;
  const done = milestones.filter((m) => m.done).length;
  return Math.round((done / milestones.length) * 100);
});

tenderSchema.virtual('openMilestones').get(function () {
  return (this.pdp?.milestones || []).filter((m) => !m.done);
});

// Margin is derived rather than trusted: a stored marginPct drifts the moment
// either price changes.
tenderSchema.virtual('computedMarginPct').get(function () {
  const price = this.fdp?.proposedPrice || 0;
  const cost = this.fdp?.estimatedCost || 0;
  if (!price) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
});

tenderSchema.pre('save', function stampDates() {
  if (this.isModified('status')) {
    if (SUBMITTED_STATUSES.includes(this.status) && !this.submittedAt) {
      this.submittedAt = new Date();
    }
    if (CLOSED_STATUSES.includes(this.status) && !this.decidedAt) {
      this.decidedAt = new Date();
    }
  }
});

tenderSchema.index({ archived: 1, status: 1, deadline: 1 });
tenderSchema.index({ deadline: 1 });

tenderSchema.statics.TENDER_TYPES = TENDER_TYPES;
tenderSchema.statics.TENDER_STATUSES = TENDER_STATUSES;
tenderSchema.statics.CLOSED_STATUSES = CLOSED_STATUSES;
tenderSchema.statics.SUBMITTED_STATUSES = SUBMITTED_STATUSES;
tenderSchema.statics.SOURCES = SOURCES;
tenderSchema.statics.CLOSING_SOON_DAYS = CLOSING_SOON_DAYS;

module.exports = mongoose.model('Tender', tenderSchema);
