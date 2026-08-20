const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Tier sets the expected contact rhythm. "Overdue for contact" is meaningless
// as an absolute — a strategic account expects a touch every fortnight, a
// standard one every quarter — so cadence is derived from tier unless the
// account owner overrides it.
const TIERS = ['Strategic', 'Key', 'Standard'];

const DEFAULT_CADENCE_DAYS = {
  Strategic: 14,
  Key: 30,
  Standard: 90,
};

const CLIENT_STATUSES = ['Onboarding', 'Active', 'Dormant', 'Churned'];

// Worst-first, so healthStatus can pick the most severe live reason.
const HEALTH_ORDER = ['Critical', 'At Risk', 'Watch', 'Healthy'];

const RENEWAL_HORIZON_DAYS = 90;
const LOW_SATISFACTION_THRESHOLD = 3; // out of 5

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

// "I'll send you the pricing by Friday." Dropped promises cost more accounts
// than bad product does, so a commitment is a first-class record with an owner
// and a due date rather than a line buried in a meeting note.
const commitmentSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    owner: { type: String, default: '' },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdBy: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

// Per-client satisfaction (the "Sati-Survey"). Deliberately a plain 1–5 score
// plus a verbatim comment: the value is the trend and what they actually said,
// not an elaborate survey builder.
const surveySchema = new mongoose.Schema(
  {
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    respondent: { type: String, default: '' },
    collectedBy: { type: String, default: '' },
    collectedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sector: { type: String, default: '' },
    tier: { type: String, enum: TIERS, default: 'Standard' },
    status: { type: String, enum: CLIENT_STATUSES, default: 'Active' },
    accountOwner: { type: String, default: '' },

    contacts: [contactSchema],

    // Explicit override; falls back to the tier default via `expectedCadenceDays`.
    contactCadenceDays: { type: Number },

    relationshipStart: { type: Date },
    contractValue: { type: Number, default: 0 },
    renewalDate: { type: Date },

    // Where the relationship came from, and the story we tell about it.
    sourcePipelineItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline' },
    linkedCaseStudy: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },

    notes: { type: String, default: '' },
    tags: [{ type: String }],

    // Denormalised from the Interaction collection. Recomputed whenever an
    // interaction is logged or removed — every list view and the health
    // calculation need it, and an aggregation per client per request would be
    // the module's slowest query for no benefit.
    lastContactAt: { type: Date },
    lastContactBy: { type: String, default: '' },
    lastContactType: { type: String, default: '' },

    commitments: [commitmentSchema],
    surveys: [surveySchema],

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const daysBetween = (from, to) => Math.round((to - from) / MS_PER_DAY);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

clientSchema.virtual('expectedCadenceDays').get(function () {
  return this.contactCadenceDays || DEFAULT_CADENCE_DAYS[this.tier] || 90;
});

clientSchema.virtual('daysSinceLastContact').get(function () {
  if (!this.lastContactAt) return null;
  return daysBetween(new Date(this.lastContactAt), new Date());
});

clientSchema.virtual('daysToRenewal').get(function () {
  if (!this.renewalDate) return null;
  const renewal = new Date(this.renewalDate);
  return daysBetween(startOfToday(), new Date(renewal.getFullYear(), renewal.getMonth(), renewal.getDate()));
});

clientSchema.virtual('openCommitments').get(function () {
  return (this.commitments || []).filter((c) => !c.completed);
});

clientSchema.virtual('overdueCommitments').get(function () {
  const today = startOfToday();
  return (this.commitments || []).filter(
    (c) => !c.completed && c.dueDate && new Date(c.dueDate) < today
  );
});

clientSchema.virtual('latestSurvey').get(function () {
  if (!this.surveys?.length) return null;
  return [...this.surveys].sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt))[0];
});

clientSchema.virtual('satisfactionScore').get(function () {
  return this.latestSurvey ? this.latestSurvey.score : null;
});

// Direction of travel matters more than the absolute number — a 4 that used to
// be a 5 is a warning, a 3 that used to be a 2 is a win.
clientSchema.virtual('satisfactionTrend').get(function () {
  if (!this.surveys || this.surveys.length < 2) return 'flat';
  const sorted = [...this.surveys].sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));
  const delta = sorted[0].score - sorted[1].score;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
});

/**
 * The heart of the module: why does this account need someone's attention?
 * Explicit reasons rather than an opaque score — the work queue groups by them,
 * and "gone quiet for 62 days" tells a rep what to do in a way that "health: 34"
 * never does.
 */
clientSchema.virtual('attentionReasons').get(function () {
  if (this.archived || this.status === 'Churned') return [];

  const reasons = [];
  const cadence = this.expectedCadenceDays;
  const since = this.daysSinceLastContact;

  if (this.status !== 'Dormant') {
    if (since === null) {
      reasons.push({
        code: 'never-contacted',
        label: 'No contact ever logged',
        severity: 'At Risk',
        detail: 'Nothing recorded against this account yet.',
      });
    } else if (since > cadence) {
      const overdueBy = since - cadence;
      const severity = since > cadence * 3 ? 'Critical' : since > cadence * 2 ? 'At Risk' : 'Watch';
      reasons.push({
        code: 'gone-quiet',
        label: 'Gone quiet',
        severity,
        detail: `${since} days since last contact — ${overdueBy} past the ${cadence}-day cadence.`,
      });
    }
  }

  const overdue = this.overdueCommitments;
  if (overdue.length > 0) {
    reasons.push({
      code: 'commitment-overdue',
      label: 'Commitment overdue',
      severity: overdue.length > 1 ? 'At Risk' : 'Watch',
      detail: `${overdue.length} promise(s) past their due date.`,
    });
  }

  const toRenewal = this.daysToRenewal;
  if (toRenewal !== null && toRenewal >= 0 && toRenewal <= RENEWAL_HORIZON_DAYS) {
    reasons.push({
      code: 'renewal-approaching',
      label: 'Renewal approaching',
      severity: toRenewal <= 30 ? 'At Risk' : 'Watch',
      detail: `Renews in ${toRenewal} day(s).`,
    });
  } else if (toRenewal !== null && toRenewal < 0) {
    reasons.push({
      code: 'renewal-lapsed',
      label: 'Renewal date passed',
      severity: 'Critical',
      detail: `Renewal was due ${Math.abs(toRenewal)} day(s) ago.`,
    });
  }

  const score = this.satisfactionScore;
  if (score !== null && score <= LOW_SATISFACTION_THRESHOLD) {
    reasons.push({
      code: 'low-satisfaction',
      label: 'Low satisfaction',
      severity: score <= 2 ? 'Critical' : 'Watch',
      detail: `Latest score ${score}/5${this.satisfactionTrend === 'down' ? ' and falling' : ''}.`,
    });
  } else if (score !== null && this.satisfactionTrend === 'down') {
    reasons.push({
      code: 'satisfaction-falling',
      label: 'Satisfaction falling',
      severity: 'Watch',
      detail: `Down to ${score}/5 at the last check-in.`,
    });
  }

  return reasons;
});

clientSchema.virtual('healthStatus').get(function () {
  if (this.archived) return 'Archived';
  if (this.status === 'Churned') return 'Churned';
  if (this.status === 'Dormant') return 'Dormant';
  const reasons = this.attentionReasons;
  if (reasons.length === 0) return 'Healthy';
  // Worst live reason wins.
  return HEALTH_ORDER.find((level) => reasons.some((r) => r.severity === level)) || 'Healthy';
});

clientSchema.index({ archived: 1, status: 1, name: 1 });
clientSchema.index({ accountOwner: 1 });

clientSchema.statics.TIERS = TIERS;
clientSchema.statics.CLIENT_STATUSES = CLIENT_STATUSES;
clientSchema.statics.DEFAULT_CADENCE_DAYS = DEFAULT_CADENCE_DAYS;
clientSchema.statics.RENEWAL_HORIZON_DAYS = RENEWAL_HORIZON_DAYS;

module.exports = mongoose.model('Client', clientSchema);
