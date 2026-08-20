const mongoose = require('mongoose');

// Email and SMS outreach share ~80% of their shape — a named campaign, a
// recipient list, and repeated sends to that list. They differ only in which
// columns matter and whether performance metrics exist at all. One collection
// with a `channel` discriminator, the same approach models/Content.js takes for
// its five content types.
const CHANNELS = ['Email', 'SMS'];

const STATUSES = ['Draft', 'Active', 'Completed'];

// The workspace does not send anything — there is no email or SMS provider in
// the stack. A batch is the RECORD of a send made elsewhere (Mailchimp, a
// phone), which is why sentAt is supplied rather than generated.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// How long after a send before nobody remembers to go and read the report.
const METRICS_GRACE_DAYS = 3;

// Percentages, not counts: this is what Mailchimp puts on screen, so entering
// it costs no arithmetic. `recipientCount` is kept alongside so approximate
// counts stay derivable and roll-ups can be weighted by batch size.
const batchMetricsSchema = new mongoose.Schema(
  {
    openedNoReplyPct: { type: Number, min: 0, max: 100 },
    repliedPct: { type: Number, min: 0, max: 100 },
    notOpenedPct: { type: Number, min: 0, max: 100 },
    bouncedPct: { type: Number, min: 0, max: 100 },
    enteredAt: { type: Date },
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    batchNumber: { type: Number, required: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    sentAt: { type: Date, required: true },
    sentBy: { type: String, default: '' },
    // Frozen at send time. The list can grow afterwards, so a percentage has to
    // be read against the size of the list as it was on the day.
    recipientCount: { type: Number, default: 0 },
    metrics: { type: batchMetricsSchema, default: () => ({}) },
    note: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const outreachCampaignSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    owner: { type: String, default: '' },
    tags: [{ type: String }],
    status: { type: String, enum: STATUSES, default: 'Draft' },

    // Bounded — a campaign has dozens of sends at most, so embedding is right.
    // Recipients are NOT embedded; see models/OutreachRecipient.js.
    batches: [batchSchema],

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

outreachCampaignSchema.virtual('batchCount').get(function () {
  return (this.batches || []).length;
});

outreachCampaignSchema.virtual('lastBatchAt').get(function () {
  if (!this.batches?.length) return null;
  return this.batches.reduce(
    (latest, b) => (!latest || b.sentAt > latest ? b.sentAt : latest),
    null
  );
});

const hasMetrics = (batch) => Boolean(batch.metrics && batch.metrics.enteredAt);

// Email batches that have been out long enough to have numbers, but nobody has
// entered them. Drives both the tab warning and the nightly reminder.
outreachCampaignSchema.virtual('batchesAwaitingMetrics').get(function () {
  if (this.channel !== 'Email' || this.archived) return [];
  const cutoff = new Date(Date.now() - METRICS_GRACE_DAYS * MS_PER_DAY);
  return (this.batches || []).filter((b) => !hasMetrics(b) && b.sentAt <= cutoff);
});

// Averaging raw percentages across differently-sized batches is simply wrong —
// a 90% open rate on 10 recipients is not worth the same as 40% on 5,000. Every
// campaign-level figure is weighted by the batch's recipientCount.
outreachCampaignSchema.virtual('overallMetrics').get(function () {
  if (this.channel !== 'Email') return null;
  const scored = (this.batches || []).filter(hasMetrics);
  if (scored.length === 0) return null;

  const totalWeight = scored.reduce((sum, b) => sum + (b.recipientCount || 0), 0);
  // Every batch went to nobody — fall back to a plain mean rather than /0.
  const weightOf = (b) => (totalWeight > 0 ? b.recipientCount || 0 : 1);
  const divisor = totalWeight > 0 ? totalWeight : scored.length;

  const weighted = (key) =>
    Math.round(
      (scored.reduce((sum, b) => sum + (b.metrics[key] || 0) * weightOf(b), 0) / divisor) * 10
    ) / 10;

  return {
    openedNoReplyPct: weighted('openedNoReplyPct'),
    repliedPct: weighted('repliedPct'),
    notOpenedPct: weighted('notOpenedPct'),
    bouncedPct: weighted('bouncedPct'),
    batchesScored: scored.length,
    totalRecipientsReached: totalWeight,
  };
});

outreachCampaignSchema.index({ channel: 1, archived: 1, createdAt: -1 });

outreachCampaignSchema.statics.CHANNELS = CHANNELS;
outreachCampaignSchema.statics.STATUSES = STATUSES;
outreachCampaignSchema.statics.METRICS_GRACE_DAYS = METRICS_GRACE_DAYS;

module.exports = mongoose.model('OutreachCampaign', outreachCampaignSchema);
