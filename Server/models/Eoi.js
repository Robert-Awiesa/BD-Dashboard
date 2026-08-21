const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Expression of Interest. Lighter than a tender: a notice we have spotted and
// must decide about. The attachment is deliberately flexible — EOIs arrive as
// newspaper clippings, WhatsApp screenshots, website links or meeting notes, so
// the record accepts either an uploaded image/file OR a pasted link.
//
// The point of an EOI is the DECISION. Most notices should end as a recorded
// "Pass" with a reason, so the same notice is not re-evaluated from scratch
// every time somebody spots it again.
const EOI_STATUSES = ['Open', 'Submitted', 'Under Review', 'Closed'];

const SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Referral', 'Other'];

const DECISIONS = ['Undecided', 'Pursue', 'Pass'];

const ATTACHMENT_TYPES = ['', 'link', 'upload'];

const CLOSING_SOON_DAYS = 7;
const UPCOMING_DAYS = 30;

const eoiSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    reference: { type: String, default: '' },

    source: { type: String, enum: SOURCES, default: 'Other' },
    sourceDetail: { type: String, default: '' },
    issuingAuthority: { type: String, default: '' },
    sector: { type: String, default: '' },

    // Was a String, so nothing could count down to it or sort by it.
    deadline: { type: Date },

    // Enum enforced. EOI_STATUSES existed as a static that the field ignored.
    status: { type: String, enum: EOI_STATUSES, default: 'Open' },

    owner: { type: String, default: '' },

    // Bid / no-bid. Recording a Pass is as valuable as recording a Pursue —
    // it stops the same notice being reconsidered from zero next month.
    decision: { type: String, enum: DECISIONS, default: 'Undecided' },
    decisionReason: { type: String, default: '' },
    decidedAt: { type: Date },
    decidedBy: { type: String, default: '' },

    attachmentType: { type: String, enum: ATTACHMENT_TYPES, default: '' },
    attachmentUrl: { type: String, default: '' },
    attachmentFileName: { type: String, default: '' },

    // Set once this EOI has been promoted into a full tender.
    convertedToTender: { type: mongoose.Schema.Types.ObjectId, ref: 'Tender' },

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

eoiSchema.virtual('daysToDeadline').get(function () {
  if (!this.deadline) return null;
  const d = new Date(this.deadline);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dOnly - startOfToday()) / MS_PER_DAY);
});

// Same automated tag as Tender, so both tabs read identically.
eoiSchema.virtual('deadlineStatus').get(function () {
  if (this.archived) return 'Archived';
  if (this.convertedToTender || this.decision === 'Pass' || this.status === 'Closed') return 'Decided';
  const days = this.daysToDeadline;
  if (days === null) return 'No Deadline';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due Today';
  if (days <= CLOSING_SOON_DAYS) return 'Closing Soon';
  if (days <= UPCOMING_DAYS) return 'Upcoming';
  return 'Scheduled';
});

// A notice nobody has ruled on, with the clock running out.
eoiSchema.virtual('awaitingDecision').get(function () {
  return !this.archived
    && this.decision === 'Undecided'
    && !this.convertedToTender
    && this.status !== 'Closed';
});

eoiSchema.pre('save', function stampDecision() {
  if (this.isModified('decision') && this.decision !== 'Undecided' && !this.decidedAt) {
    this.decidedAt = new Date();
  }
});

eoiSchema.index({ archived: 1, decision: 1, deadline: 1 });

eoiSchema.statics.EOI_STATUSES = EOI_STATUSES;
eoiSchema.statics.SOURCES = SOURCES;
eoiSchema.statics.DECISIONS = DECISIONS;
eoiSchema.statics.CLOSING_SOON_DAYS = CLOSING_SOON_DAYS;

module.exports = mongoose.model('Eoi', eoiSchema);
