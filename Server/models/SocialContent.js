const mongoose = require('mongoose');

// 'Other' keeps the enum honest while still letting the team post somewhere
// new — the actual name goes in platformOther rather than being typed into the
// enum, so reporting can still group on the five we run properly.
const PLATFORMS = ['TikTok', 'Instagram', 'LinkedIn', 'Facebook', 'YouTube', 'Other'];

const socialContentSchema = new mongoose.Schema(
  {
    // Shared Metadata
    platform: { type: String, enum: PLATFORMS, required: true },
    // Only meaningful when platform is 'Other'.
    platformOther: { type: String, default: '' },
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

// 'Other' means nothing without the name of the place it was posted.
socialContentSchema.pre('validate', function requirePlatformName() {
  if (this.platform === 'Other' && !String(this.platformOther || '').trim()) {
    this.invalidate('platformOther', 'Name the platform when choosing Other');
  }
});

socialContentSchema.statics.PLATFORMS = PLATFORMS;

module.exports = mongoose.model('SocialContent', socialContentSchema);
