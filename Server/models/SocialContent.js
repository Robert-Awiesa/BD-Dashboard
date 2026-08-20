const mongoose = require('mongoose');

const PLATFORMS = ['TikTok', 'Instagram', 'LinkedIn', 'Facebook', 'YouTube'];

const socialContentSchema = new mongoose.Schema(
  {
    // Shared Metadata
    platform: { type: String, enum: PLATFORMS, required: true },
    title: { type: String, required: true },

    // 1. Post Scheduling Fields
    scheduleDate: { type: Date },
    dayOfWeek: { type: String },
    time: { type: String, default: '' },
    message: { type: String, default: '' },
    postType: { type: String, default: '' },
    responsiblePerson: { type: String, default: '' },

    // 2. Scripts Repository Fields
    product: { type: String, default: '' },
    model: { type: String, default: '' },
    shotType: { type: String, default: '' },
    scriptFileUrl: { type: String, default: '' },
    scriptFileName: { type: String, default: '' },

    // 3. Content Repository (Live Archive) Fields
    postLink: { type: String, default: '' },
    interestingSnippet: { type: String, default: '' },
    coverImage: { type: String, default: '' },

    status: {
      type: String,
      enum: ['Scheduled', 'Scripted', 'Published', 'Archived'],
      default: 'Scheduled',
    },
  },
  { timestamps: true }
);

// Keep dayOfWeek in sync whenever scheduleDate is set/changed, so the table
// never shows a stale day for a date the user just edited.
socialContentSchema.pre('save', function computeDayOfWeek() {
  if (this.scheduleDate) {
    this.dayOfWeek = this.scheduleDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
});

socialContentSchema.pre('findOneAndUpdate', function computeDayOfWeek() {
  const update = this.getUpdate() || {};
  if (update.scheduleDate) {
    update.dayOfWeek = new Date(update.scheduleDate).toLocaleDateString('en-US', { weekday: 'long' });
    this.setUpdate(update);
  }
});

socialContentSchema.statics.PLATFORMS = PLATFORMS;

module.exports = mongoose.model('SocialContent', socialContentSchema);
