const mongoose = require('mongoose');

// Deliberately light. A project here is a named bucket with an owner and a
// target date — enough to group standalone work and answer "what is this for".
// The workspace already has a real phased-programme engine in DgEvent; this is
// not trying to be a second one.
const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'];

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    owner: { type: String, default: '' },
    targetDate: { type: Date },
    status: { type: String, enum: PROJECT_STATUSES, default: 'Active' },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.virtual('daysToTarget').get(function () {
  if (!this.targetDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(this.targetDate);
  const targetOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetOnly - today) / (24 * 60 * 60 * 1000));
});

projectSchema.statics.PROJECT_STATUSES = PROJECT_STATUSES;

module.exports = mongoose.model('Project', projectSchema);
