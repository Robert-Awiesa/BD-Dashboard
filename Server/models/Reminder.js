const mongoose = require('mongoose');

// 'Interaction' rather than 'FieldVisit' because sourceId uses refPath — the
// value has to match a registered model name for population to resolve.
const SOURCE_TYPES = [
  'Campaign', 'Event', 'Milestone', 'Document', 'Client', 'Interaction',
  'Proposal', 'OutreachCampaign', 'Tender', 'Eoi', 'Holiday',
  'Training', 'TrainingSchedule', 'Certification',
];

const rescheduleEntrySchema = new mongoose.Schema(
  {
    previousDate: { type: String, required: true },
    newDate: { type: String, required: true },
    reason: { type: String, required: true },
    rescheduledAt: { type: Date, default: Date.now },
    rescheduledBy: { type: String, default: '' },
  },
  { _id: false }
);

const completionMetricsSchema = new mongoose.Schema(
  {
    completedAt: { type: Date, default: Date.now },
    completedBy: { type: String, default: '' },
    completionNotes: { type: String, default: '' },
    deliverables: { type: String, default: '' },
    performanceData: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

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

    // Lifecycle resolution status
    lifecycleStatus: {
      type: String,
      enum: ['Upcoming', 'Active Alert', 'Rescheduled', 'Completed'],
      default: 'Upcoming',
    },

    // Deadline tracking
    originalDeadlineDate: { type: String, default: '' },
    currentDeadlineDate: { type: String, default: '' },

    // Audit trail for rescheduling
    rescheduleHistory: [rescheduleEntrySchema],

    // Early completion & performance logging
    performanceMetrics: completionMetricsSchema,

    actioned: { type: Boolean, default: false },
    actionedAt: { type: Date },
  },
  { timestamps: true }
);

reminderSchema.index({ sourceType: 1, sourceId: 1, reminderDate: 1 }, { unique: true });

reminderSchema.statics.SOURCE_TYPES = SOURCE_TYPES;

module.exports = mongoose.model('Reminder', reminderSchema);
