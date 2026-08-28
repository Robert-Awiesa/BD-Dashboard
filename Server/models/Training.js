const mongoose = require('mongoose');

const TRAINING_TYPES = ['Internal', 'External'];
const PROGRESS_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'];

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: TRAINING_TYPES, required: true },
    dateRange: {
      start: { type: Date },
      end: { type: Date }
    },
    participants: [{ type: String, trim: true }], // Keeping it simple as strings (names/emails)
    facilitator: { type: String, trim: true },
    description: { type: String, trim: true },
    progress: { type: String, enum: PROGRESS_STATUSES, default: 'Planned' },
    takeaways: { type: String, trim: true, default: '' },
    
    // External specific fields
    externalDetails: {
      modality: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      organizers: { type: String, trim: true, default: '' },
      cost: { type: String, trim: true, default: 'Free' }
    },

    // Archive before delete, as everywhere else in the workspace: a record
    // removed by a misclick takes its history with it.
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

trainingSchema.statics.TRAINING_TYPES = TRAINING_TYPES;
trainingSchema.statics.PROGRESS_STATUSES = PROGRESS_STATUSES;

module.exports = mongoose.model('Training', trainingSchema);
