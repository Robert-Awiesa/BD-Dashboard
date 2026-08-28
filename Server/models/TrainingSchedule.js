const mongoose = require('mongoose');

const CATEGORIES = ['AWS', 'SAP', 'Esri', 'OpenText', 'BD / Tender', 'General Tech', 'Other'];
const SCHEDULE_STATUSES = ['Upcoming', 'Passed', 'Logged as Training'];

const trainingScheduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: 'AWS' },
    targetDate: { type: Date, required: true },
    targetGroup: { type: String, trim: true, default: 'All Technical Staff' },
    note: { type: String, trim: true, default: '' },
    
    // Timing virtual helpers
    targetYear: { type: Number, default: () => new Date().getFullYear() },
    targetMonth: { type: Number, default: () => new Date().getMonth() + 1 },
    
    status: { type: String, enum: SCHEDULE_STATUSES, default: 'Upcoming' },
    convertedTrainingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Training', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Days until target
trainingScheduleSchema.virtual('daysUntil').get(function () {
  if (!this.targetDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(this.targetDate);
  const targetOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetOnly - today) / (24 * 60 * 60 * 1000));
});

trainingScheduleSchema.pre('save', function () {
  if (this.targetDate) {
    const d = new Date(this.targetDate);
    this.targetYear = d.getFullYear();
    this.targetMonth = d.getMonth() + 1;
  }
});

trainingScheduleSchema.index({ targetYear: 1, targetMonth: 1 });
trainingScheduleSchema.statics.CATEGORIES = CATEGORIES;
trainingScheduleSchema.statics.SCHEDULE_STATUSES = SCHEDULE_STATUSES;

module.exports = mongoose.model('TrainingSchedule', trainingScheduleSchema);
