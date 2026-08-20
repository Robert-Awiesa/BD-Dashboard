const mongoose = require('mongoose');

// 'Interaction' rather than 'FieldVisit' because sourceId uses refPath — the
// value has to match a registered model name for population to resolve.
const SOURCE_TYPES = ['Campaign', 'Event', 'Milestone', 'Document', 'Client', 'Interaction', 'Proposal', 'OutreachCampaign'];

// One row per (source, calendar day). Polymorphic rather than one collection
// per module, so the dashboard can render a single unified notification feed
// and one cron sweep covers everything.
const reminderSchema = new mongoose.Schema(
  {
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceType' },
    // Denormalised so a dismissed reminder still reads correctly even if the
    // underlying record is later renamed or deleted.
    sourceLabel: { type: String, default: '' },

    reminderDate: { type: String, required: true }, // YYYY-MM-DD
    reminderType: {
      type: String,
      enum: ['upcoming', 'overdue', 'today'],
      required: true,
    },
    message: { type: String, required: true },
    responsiblePerson: { type: String, default: '' },
    link: { type: String, default: '' }, // meeting URL / venue, surfaced in the alert

    actioned: { type: Boolean, default: false },
    actionedAt: { type: Date },
  },
  { timestamps: true }
);

reminderSchema.index({ sourceType: 1, sourceId: 1, reminderDate: 1 }, { unique: true });

reminderSchema.statics.SOURCE_TYPES = SOURCE_TYPES;

module.exports = mongoose.model('Reminder', reminderSchema);
