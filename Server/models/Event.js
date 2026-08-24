const mongoose = require('mongoose');

const EVENT_TYPES = [
  'External Conference',
  'Internal DG Briefing',
  'Internal Briefing',
  'Webinar',
  'Podcast',
  'Strategic Alignment',
  'General Event',
];
const MODALITIES = ['Virtual', 'Physical', 'Hybrid'];
const ATTENDEE_ROLES = ['Attendee', 'Speaker', 'Organizer', 'Booth Lead'];
const RSVP_STATUSES = ['Confirmed', 'Pending', 'Declined'];
const MEDIA_KINDS = ['Photo', 'Video', 'Audio', 'Document', 'Link'];

const prepTaskSchema = new mongoose.Schema(
  {
    taskName: { type: String, required: true },
    assignedTo: { type: String, default: '' },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

const attendeeSchema = new mongoose.Schema(
  {
    memberName: { type: String, required: true },
    role: { type: String, enum: ATTENDEE_ROLES, default: 'Attendee' },
    status: { type: String, enum: RSVP_STATUSES, default: 'Pending' },
  },
  { _id: true }
);

const speakerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, default: '' },
    organization: { type: String, default: '' },
    linkedin: { type: String, default: '' },
  },
  { _id: true }
);

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    label: { type: String, default: '' },
    kind: { type: String, enum: MEDIA_KINDS, default: 'Link' },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    // Stage 1 — general metadata
    title: { type: String, required: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    description: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    modality: { type: String, enum: MODALITIES, default: 'Virtual' },
    // Hybrid needs both: people join from a room AND from a link, so one
    // reused field could only ever hold half the answer.
    locationDetails: { type: String, default: '' },
    streamingLink: { type: String, default: '' },
    assignedLead: { type: String, default: '' },

    // Stage 2 — media production fields (Webinar / Podcast only)
    episodeNumber: { type: String, default: '' },
    hostModerator: { type: String, default: '' },
    speakers: [speakerSchema],
    // Cross-module links so a webinar reuses an existing script / promo campaign
    // instead of the team re-typing those details here.
    linkedScript: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialContent' },
    linkedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },

    // Stage 3 — prep pipeline & attendance
    prepChecklist: [prepTaskSchema],
    attendees: [attendeeSchema],

    // Lifecycle. Upcoming/Ongoing/Completed are DERIVED from the dates (see
    // the `derivedStatus` virtual) so they can never go stale; only an explicit
    // cancellation is stored, because nothing about the clock implies it.
    cancelled: { type: Boolean, default: false },

    // Post-event performance matrix
    metrics: {
      registrants: { type: Number },
      peakLiveAttendees: { type: Number },
      playbackViews: { type: Number },
      averageWatchTime: { type: String, default: '' },
      dropOffRate: { type: String, default: '' },
      qaInteractions: { type: Number },
      pollResponses: { type: Number },
      leadsGenerated: { type: Number },
      partnerMentions: { type: String, default: '' },
    },
    achievements: {
      keyTakeaways: [{ type: String }],
      attendeeFeedback: [{ type: String }],
      growthRecommendations: [{ type: String }],
    },
    metricsEnteredAt: { type: Date },

    mediaLinks: [mediaSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Single source of truth for what the UI shows as a status badge.
eventSchema.virtual('derivedStatus').get(function computeStatus() {
  if (this.cancelled) return 'Cancelled';
  const now = Date.now();
  const start = this.startDate ? new Date(this.startDate).getTime() : null;
  // A single-day event has no end date — treat it as ending that same day.
  const end = this.endDate
    ? new Date(this.endDate).getTime()
    : start
      ? new Date(this.startDate).setHours(23, 59, 59, 999)
      : null;

  if (start === null) return 'Upcoming';
  if (now < start) return 'Upcoming';
  if (end !== null && now > end) return 'Completed';
  return 'Ongoing';
});

eventSchema.virtual('prepProgress').get(function computeProgress() {
  const total = this.prepChecklist?.length || 0;
  if (!total) return 0;
  const done = this.prepChecklist.filter((t) => t.completed).length;
  return Math.round((done / total) * 100);
});

eventSchema.statics.EVENT_TYPES = EVENT_TYPES;
eventSchema.statics.MODALITIES = MODALITIES;
eventSchema.statics.ATTENDEE_ROLES = ATTENDEE_ROLES;
eventSchema.statics.RSVP_STATUSES = RSVP_STATUSES;

module.exports = mongoose.model('Event', eventSchema);
