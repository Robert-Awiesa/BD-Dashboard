const mongoose = require('mongoose');

const MILESTONE_TYPES = [
  // One record per team member, carrying BOTH their birthday and their work
  // start date. They used to be two separate types, which meant filing the same
  // person twice and getting two half-pictures.
  'Team Member',
  'Partner Milestone',
  'VIP Stakeholder Birthday',
  // Client appreciation reuses this model rather than duplicating the recurring
  // month/day machinery, the nextOccurrence maths and the reminder sweep.
  'Client Anniversary',
  'Client Contact Birthday',
];

// Types that belong to an account rather than to the team.
const CLIENT_MILESTONE_TYPES = ['Client Anniversary', 'Client Contact Birthday'];

// What each type actually needs.
//
// `anchor` is where the recurring month/day comes from:
//   'birth'    typed in, no year counted (a birthday needs no birth year)
//   'start'    read off the start date — a partnership anniversary IS the day
//              it began, so asking for month and day as well asks twice
//   'explicit' typed in, but years are still counted from the start date
const TYPE_RULES = {
  'Team Member': { anchor: 'birth', startDate: 'required', startLabel: 'Work start date' },
  'Partner Milestone': { anchor: 'start', startDate: 'required', startLabel: 'Partnership start date' },
  'VIP Stakeholder Birthday': { anchor: 'birth', startDate: 'none', startLabel: '' },
  // Client appreciation keeps its own date: an account's anniversary is often
  // observed on a review date rather than the literal signing day.
  'Client Anniversary': { anchor: 'explicit', startDate: 'optional', startLabel: 'Client since' },
  'Client Contact Birthday': { anchor: 'birth', startDate: 'none', startLabel: '' },
};

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
    milestoneMonth: { type: Number, min: 1, max: 12 },
    milestoneDay: { type: Number, min: 1, max: 31 },

    // Tenure. What it means depends on the type — see TYPE_RULES.startLabel:
    // a team member's work start date, the day a partnership began, the day a
    // client came on board. Never a birth year: a birthday needs only month
    // and day, so nobody has to disclose their age.
    originalStartDate: { type: Date },

    // A record can be saved incomplete and finished later, but it is not a
    // usable milestone until the required dates are in.
    isDraft: { type: Boolean, default: false },

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

milestoneSchema.pre('validate', function applyTypeRules() {
  const rule = TYPE_RULES[this.milestoneType];
  if (!rule) return;

  // A partnership or client anniversary recurs on the day it began, so asking
  // for a month and day as well is asking the same question twice.
  if (rule.anchor === 'start' && this.originalStartDate) {
    const d = new Date(this.originalStartDate);
    this.milestoneMonth = d.getMonth() + 1;
    this.milestoneDay = d.getDate();
  }

  // A birthday needs no year, so a start date on these types is a privacy
  // problem rather than a missing feature.
  if (rule.startDate === 'none') this.originalStartDate = undefined;

  // Drafts are exempt: the point of a draft is to save what you have.
  if (this.isDraft) return;

  if (rule.startDate === 'required' && !this.originalStartDate) {
    this.invalidate('originalStartDate', `${rule.startLabel} is required — save as a draft if you do not have it yet`);
  }
  if (!this.milestoneMonth || !this.milestoneDay) {
    const what = rule.anchor === 'start' ? rule.startLabel : 'A month and day';
    this.invalidate('milestoneDay', `${what} is required — save as a draft if you do not have it yet`);
  }
});

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

// A team member has TWO dates worth celebrating — their birthday and the day
// they joined — so one record yields more than one occurrence. Everything that
// lists, groups or reminds reads this rather than assuming one date per record.
milestoneSchema.virtual('occurrences').get(function computeOccurrences() {
  const rule = TYPE_RULES[this.milestoneType];
  if (!rule) return [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Feb 29 is observed on Feb 28 in a common year so it is never skipped.
  const nextFor = (month, day) => {
    if (!month || !day) return null;
    const build = (year) => {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const d = month === 2 && day === 29 && !isLeap ? 28 : day;
      return new Date(year, month - 1, d);
    };
    let next = build(today.getFullYear());
    if (next < today) next = build(today.getFullYear() + 1);
    return next;
  };

  const entry = (kind, label, month, day, countYearsFrom) => {
    const next = nextFor(month, day);
    if (!next) return null;
    return {
      kind,
      label,
      month,
      day,
      next,
      daysUntil: Math.round((next - today) / (24 * 60 * 60 * 1000)),
      years: countYearsFrom
        ? next.getFullYear() - new Date(countYearsFrom).getFullYear()
        : null,
    };
  };

  const out = [];

  if (rule.anchor === 'birth') {
    out.push(entry('Birthday', 'Birthday', this.milestoneMonth, this.milestoneDay, null));
  } else {
    // 'start' derives the date; 'explicit' keeps the typed one. Both count
    // years from the start date.
    out.push(entry('Milestone', rule.startLabel || 'Anniversary',
      this.milestoneMonth, this.milestoneDay, this.originalStartDate));
  }

  // The second date a team member carries.
  if (this.milestoneType === 'Team Member' && this.originalStartDate) {
    const d = new Date(this.originalStartDate);
    out.push(entry('Milestone', 'Work anniversary', d.getMonth() + 1, d.getDate(), this.originalStartDate));
  }

  return out.filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil);
});

// The soonest of them, so a list can still sort on one number.
milestoneSchema.virtual('nextUp').get(function computeNextUp() {
  return this.occurrences[0] || null;
});

milestoneSchema.statics.MILESTONE_TYPES = MILESTONE_TYPES;
milestoneSchema.statics.CLIENT_MILESTONE_TYPES = CLIENT_MILESTONE_TYPES;
milestoneSchema.statics.TYPE_RULES = TYPE_RULES;

module.exports = mongoose.model('Milestone', milestoneSchema);
