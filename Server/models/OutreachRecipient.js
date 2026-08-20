const mongoose = require('mongoose');

// One document per recipient per campaign.
//
// NOT embedded in OutreachCampaign: a 500-name list sent to 50 times would put
// 25,000 subdocuments in a single document, approaching the 16MB ceiling and
// forcing the entire list to load on every read. Same split the workspace
// already uses for Client (embedded commitments) vs Interaction (its own
// collection) — bounded data embeds, unbounded data gets a collection.
const STATUSES = ['Not Sent', 'Sent', 'Replied', 'No Reply', 'Bounced'];

// SMS has no bounce concept here — a failed SMS is just no reply.
const SMS_STATUSES = ['Not Sent', 'Sent', 'Replied', 'No Reply'];

const SOURCE_TYPES = ['Manual', 'Excel', 'Prospecting Lead', 'Client'];

// The audit trail that answers "when did we contact them, and how often".
// Bounded per recipient (dozens of sends), so embedding here is safe.
const sendSchema = new mongoose.Schema(
  {
    batchNumber: { type: Number, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId },
    sentAt: { type: Date, required: true },
    subject: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const outreachRecipientSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OutreachCampaign',
      required: true,
      index: true,
    },

    // --- Grid columns. Email shows title/email/contact; SMS shows contact/company.
    name: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    email: { type: String, default: '' },
    contact: { type: String, default: '' }, // phone
    company: { type: String, default: '' },
    // The free-text "details on whether email was sent" column.
    notes: { type: String, default: '' },

    // What the row dropdown edits. Deliberately a CURRENT state rather than a
    // per-send outcome: "have they replied" is how a person actually reads a
    // list. The per-send record lives in `sends` below.
    currentStatus: { type: String, enum: STATUSES, default: 'Not Sent' },

    lastSentAt: { type: Date },
    sendCount: { type: Number, default: 0 },
    sends: [sendSchema],

    // Provenance, so an imported row can be traced back and de-duplicated.
    sourceType: { type: String, enum: SOURCE_TYPES, default: 'Manual' },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Newest-first ordering for the expanded send history.
outreachRecipientSchema.virtual('sendHistory').get(function () {
  return [...(this.sends || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
});

outreachRecipientSchema.index({ campaign: 1, name: 1 });
// Dedupe lookups on import.
outreachRecipientSchema.index({ campaign: 1, email: 1 });
outreachRecipientSchema.index({ campaign: 1, contact: 1 });

outreachRecipientSchema.statics.STATUSES = STATUSES;
outreachRecipientSchema.statics.SMS_STATUSES = SMS_STATUSES;
outreachRecipientSchema.statics.SOURCE_TYPES = SOURCE_TYPES;

module.exports = mongoose.model('OutreachRecipient', outreachRecipientSchema);
