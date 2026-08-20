const mongoose = require('mongoose');

const MILESTONE_TYPES = [
  'Team Birthday',
  'Work Anniversary',
  'Partner Milestone',
  'VIP Stakeholder Birthday',
  // Client appreciation reuses this model rather than duplicating the recurring
  // month/day machinery, the nextOccurrence maths and the reminder sweep.
  'Client Anniversary',
  'Client Contact Birthday',
];

// Types that belong to an account rather than to the team.
const CLIENT_MILESTONE_TYPES = ['Client Anniversary', 'Client Contact Birthday'];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    label: { type: String, default: '' },
    kind: { type: String, enum: ['Photo', 'Video', 'Audio', 'Document', 'Link'], default: 'Link' },
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    milestoneType: { type: String, enum: MILESTONE_TYPES, required: true },
    participantName: { type: String, required: true },
    departmentOrCompany: { type: String, default: '' },
    role: { type: String, default: '' },

    // Set for client appreciation milestones so the reminder names the account
    // and the client record can list its own dates.
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },

    // Stored as month + day so the milestone recurs every year with no reset.
    milestoneMonth: { type: Number, min: 1, max: 12, required: true },
    milestoneDay: { type: Number, min: 1, max: 31, required: true },

    // Only needed where tenure matters (work anniversaries, partner milestones)
    // — deliberately optional so a birthday need not disclose birth year.
    originalStartDate: { type: Date },

    photo: { type: String, default: '' },
    favouriteQuote: { type: String, default: '' },
    notes: { type: String, default: '' },
    mediaLinks: [mediaSchema],

    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Reject impossible dates like 31 February. Feb 29 IS allowed — see nextOccurrence.
milestoneSchema.pre('validate', function validateDayOfMonth() {
  if (this.milestoneMonth && this.milestoneDay) {
    const max = DAYS_IN_MONTH[this.milestoneMonth - 1];
    if (this.milestoneDay > max) {
      this.invalidate('milestoneDay', `Month ${this.milestoneMonth} has at most ${max} days`);
    }
  }
});

// The next calendar date this milestone falls on, from today forward.
// Feb 29 in a non-leap year is observed on Feb 28 so it is never skipped.
milestoneSchema.virtual('nextOccurrence').get(function computeNext() {
  if (!this.milestoneMonth || !this.milestoneDay) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const build = (year) => {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    let day = this.milestoneDay;
    if (this.milestoneMonth === 2 && day === 29 && !isLeap) day = 28;
    return new Date(year, this.milestoneMonth - 1, day);
  };

  let next = build(today.getFullYear());
  if (next < today) next = build(today.getFullYear() + 1);
  return next;
});

milestoneSchema.virtual('daysUntil').get(function computeDaysUntil() {
  const next = this.nextOccurrence;
  if (!next) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((next - today) / (24 * 60 * 60 * 1000));
});

// e.g. a 2021 start date shows "5th year" at the 2026 occurrence.
milestoneSchema.virtual('yearsCompleted').get(function computeYears() {
  if (!this.originalStartDate) return null;
  const next = this.nextOccurrence;
  if (!next) return null;
  return next.getFullYear() - new Date(this.originalStartDate).getFullYear();
});

milestoneSchema.statics.MILESTONE_TYPES = MILESTONE_TYPES;
milestoneSchema.statics.CLIENT_MILESTONE_TYPES = CLIENT_MILESTONE_TYPES;

module.exports = mongoose.model('Milestone', milestoneSchema);
