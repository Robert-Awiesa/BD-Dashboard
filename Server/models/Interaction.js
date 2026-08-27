const mongoose = require('mongoose');

// Its own collection rather than an array on Client: interactions grow without
// bound, and the team activity feed queries *across* clients ("what did anyone
// learn this week?"), which an embedded array makes awkward and slow.
const INTERACTION_TYPES = ['Call', 'Meeting', 'Site Visit', 'Email', 'Event', 'Support', 'Note'];

const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

// A visit is the one interaction that can be booked before it happens.
const VISIT_STATUSES = ['Planned', 'Completed', 'Cancelled'];

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: '' },
  },
  { _id: true }
);

// One entry per save: what happened, who did it, and which fields moved.
const changeSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: String, default: '' },
    action: { type: String, default: 'Updated' },
    changes: [
      {
        _id: false,
        field: { type: String },
        from: { type: String },
        to: { type: String },
      },
    ],
  },
  { _id: true }
);

const interactionSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    type: { type: String, enum: INTERACTION_TYPES, default: 'Call' },

    // The only field anyone is required to write. Logging has to take ten
    // seconds or it does not happen, and a module with no interactions in it
    // is worse than no module at all.
    summary: { type: String, required: true, trim: true },
    detail: { type: String, default: '' },

    occurredAt: { type: Date, default: Date.now },
    loggedBy: { type: String, required: true },

    contactName: { type: String, default: '' },
    sentiment: { type: String, enum: SENTIMENTS, default: 'Neutral' },
    followUpNeeded: { type: Boolean, default: false },

    linkedEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },

    // --- Field visit extras -------------------------------------------------
    // Only populated when type === 'Site Visit'. Field Visits is a
    // visit-centric *view* over this collection rather than a separate silo:
    // a site visit is a client touch like any other, so keeping it here means
    // the client timeline stays the complete picture instead of half the story.
    //
    // Unlike every other interaction type a visit can be recorded *ahead* of
    // time, which is why it carries its own status.
    visitStatus: { type: String, enum: VISIT_STATUSES },
    visitType: { type: String, enum: ['Standard', 'Discovery'], default: 'Standard' },
    locationName: { type: String, default: '' },
    address: { type: String, default: '' },
    purpose: { type: String, default: '' },
    observations: { type: String, default: '' },
    teamAttendees: [{ type: String }],
    clientAttendees: [{ type: String }],
    photos: [photoSchema],
    durationMinutes: { type: Number },

    // Discovery session specific structured details
    discoveryDetails: {
      operation: { type: String, default: '' },
      personnel: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      clientRequest: { type: String, default: '' },
      summary: { type: String, default: '' },
      painPoints: [
        {
          title: { type: String, default: '' },
          description: { type: String, default: '' },
        },
      ],
      propositions: [
        {
          title: { type: String, default: '' },
          description: { type: String, default: '' },
        },
      ],
      usersCount: { type: String, default: '' },
      processFlow: { type: String, default: '' },
      additionalNotes: { type: String, default: '' },
    },

    // A visit is booked, walked, written up and corrected — often by different
    // people days apart. Without a trail, "the purpose changed" or "the date
    // moved" is unanswerable, and a write-up that contradicts what was planned
    // looks like a mistake rather than a decision.
    history: [changeSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Feed and timeline both read newest-first.
interactionSchema.index({ occurredAt: -1 });
interactionSchema.index({ client: 1, occurredAt: -1 });

// A completed visit nobody has written up is the module's core failure mode —
// the trip happened, the knowledge is in someone's head, and it never lands.
interactionSchema.virtual('awaitingReport').get(function () {
  return this.visitStatus === 'Completed' && !(this.observations || '').trim();
});

interactionSchema.index({ visitStatus: 1, occurredAt: -1 });

interactionSchema.statics.INTERACTION_TYPES = INTERACTION_TYPES;
interactionSchema.statics.SENTIMENTS = SENTIMENTS;
interactionSchema.statics.VISIT_STATUSES = VISIT_STATUSES;

module.exports = mongoose.model('Interaction', interactionSchema);
