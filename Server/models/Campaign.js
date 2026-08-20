const mongoose = require('mongoose');

const LOCATION_TYPES = ['Online', 'Physical', 'Hybrid'];
const AD_FORMATS = [
  'Video', 'Single image', 'Multiple images', 'Text',
  'Spotlight', 'Message', 'Conversation', 'Event', 'Document',
];
const PLACEMENT_SITES = ['News Paper', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'];
const BUDGET_TYPES = ['Daily budget', 'Life time', 'Both'];
const COMPANY_SIZES = ['1-20', '20-40', '40-60', '60-80', '80-100', '100+'];
const DEGREES = ['BSc', 'Masters', 'PhD'];
const STATUSES = ['Planning', 'Active', 'Completed', 'Reschedule Needed'];

// One metrics entry per platform the campaign runs on. `metrics` is a flexible
// bag (Mixed) because each platform's report template has a different shape
// (LinkedIn: impressions/reactions; TikTok: audience reached/views; etc.) —
// modeling every possible field as a fixed column doesn't scale across platforms.
const platformMetricsSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLACEMENT_SITES, required: true },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    enteredAt: { type: Date },
  },
  { _id: false }
);

const insightsSchema = new mongoose.Schema(
  {
    areasOfConcern: [{ type: String }],
    positiveTrends: [{ type: String }],
    keyOpportunities: [{ type: String }],
    growthStrategyNotes: [{ type: String }],
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    // Stage 1: Strategy & Audience Targeting
    campaignName: { type: String, required: true },
    targetAudience: [{ type: String }],
    excludedAudience: [{ type: String }],
    locationType: { type: String, enum: LOCATION_TYPES, required: true },
    physicalLocation: { type: String, default: '' },
    targetIndustries: [{ type: String }],
    targetCompanies: [{ type: String }],
    companySize: { type: String, enum: COMPANY_SIZES },
    companyAnnualRevenue: { type: String, default: '' },
    audienceDegrees: [{ type: String, enum: DEGREES }],
    audienceAgeRange: { type: String, default: '' },
    audienceDevices: [{ type: String }],

    // Stage 2: Format Selection
    adFormats: [{ type: String, enum: AD_FORMATS }],

    // Stage 3: Placement, Budget & Schedule
    platforms: [{ type: String, enum: PLACEMENT_SITES }],
    budgetType: { type: String, enum: BUDGET_TYPES, required: true },
    budgetAmount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    responsiblePerson: { type: String, required: true },

    // Lifecycle
    status: { type: String, enum: STATUSES, default: 'Planning' },

    // Metrics & Insights (filled in after the campaign runs)
    platformMetrics: [platformMetricsSchema],
    insights: { type: insightsSchema, default: () => ({}) },
    metricsCompletedAt: { type: Date },
  },
  { timestamps: true }
);

campaignSchema.statics.LOCATION_TYPES = LOCATION_TYPES;
campaignSchema.statics.AD_FORMATS = AD_FORMATS;
campaignSchema.statics.PLACEMENT_SITES = PLACEMENT_SITES;
campaignSchema.statics.BUDGET_TYPES = BUDGET_TYPES;
campaignSchema.statics.COMPANY_SIZES = COMPANY_SIZES;
campaignSchema.statics.DEGREES = DEGREES;
campaignSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Campaign', campaignSchema);
