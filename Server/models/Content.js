const mongoose = require('mongoose');

// One collection, five shapes. A single polymorphic model keeps cross-category
// search, tagging, status workflow and engagement tracking in one place —
// splitting Articles/Assets/Surveys/FAQs/UserStories into five collections
// would mean five of everything for very little gain.
const CONTENT_TYPES = ['Article', 'Asset', 'Survey', 'FAQ', 'UserStory'];

const STATUSES = ['Draft', 'Ready for Review', 'Scheduled', 'Published'];

const ASSET_CATEGORIES = [
  'Brand Logo',
  'Product Graphic',
  'Event Photo',
  'Banner',
  'Media Kit',
  'Other',
];

const OBJECTION_CATEGORIES = ['Pricing', 'Technical Integration', 'Security', 'General'];

// Survey findings are either internal ammunition or a public lead magnet, and
// the distinction changes how the team may use the numbers.
const LEAD_MAGNET_STATUSES = ['Internal Use Only', 'Public Release'];

const contentSchema = new mongoose.Schema(
  {
    contentType: { type: String, enum: CONTENT_TYPES, required: true },

    // --- Common ---
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    authorOrUploader: { type: String, required: true },
    lastEditedBy: { type: String, default: '' },
    tags: [{ type: String }],
    status: { type: String, enum: STATUSES, default: 'Draft' },
    // 'Scheduled' is meaningless without a date to be scheduled for.
    scheduledFor: { type: Date },
    publishedAt: { type: Date },

    // --- Articles & User Stories ---
    contentBody: { type: String, default: '' }, // markdown
    categorySector: { type: String, default: '' }, // FinTech, Healthcare, Logistics…

    // --- Articles ---
    subtitle: { type: String, default: '' },
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    focusKeyword: { type: String, default: '' },
    publicUrl: { type: String, default: '' }, // live post URL, pulled into social promos
    // Cover art is picked from the Assets library rather than re-uploaded, so
    // replacing the asset updates every article using it.
    coverAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },

    // --- Images & Assets ---
    assetCategory: { type: String, enum: ASSET_CATEGORIES },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' }, // PNG, JPG, SVG, MP4
    fileSize: { type: String, default: '' },
    dimensions: { type: String, default: '' }, // "1920x1080px"
    altText: { type: String, default: '' }, // accessibility + SEO
    usageRights: { type: String, default: '' },
    usageRightsExpiry: { type: Date },

    // --- Survey Results ---
    targetAudience: { type: String, default: '' },
    sampleSize: { type: String, default: '' },
    keyTakeaways: [{ type: String }],
    infographicUrl: { type: String, default: '' },
    leadMagnetStatus: { type: String, enum: LEAD_MAGNET_STATUSES, default: 'Internal Use Only' },

    // --- FAQ / objection handling ---
    objectionCategory: { type: String, enum: OBJECTION_CATEGORIES },
    verifiedAnswer: { type: String, default: '' },
    associatedProduct: { type: String, default: '' },

    // --- User Stories / case studies ---
    clientName: { type: String, default: '' },
    challenge: { type: String, default: '' },
    solution: { type: String, default: '' },
    quantifiableResults: { type: String, default: '' },
    testimonialQuote: { type: String, default: '' },
    clientLogo: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    // The full case study PDF lives in Reports & Docs; this points at it rather
    // than keeping a second copy that can drift out of sync.
    caseStudyDoc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },

    // --- Engagement (shared-workspace tracking) ---
    viewCount: { type: Number, default: 0 },
    downloadOrUsageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    lastUsedBy: { type: String, default: '' },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// A download/placement is a stronger signal that collateral is earning its keep
// than a glance, so it carries more weight in the "top performing" panels.
contentSchema.virtual('engagementScore').get(function () {
  return (this.viewCount || 0) + (this.downloadOrUsageCount || 0) * 3;
});

// Licensed assets expire. Using a stock photo past its term is a real liability,
// so the state is computed on read and surfaced as a badge.
contentSchema.virtual('rightsStatus').get(function () {
  if (this.contentType !== 'Asset' || !this.usageRightsExpiry) return 'Unrestricted';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(this.usageRightsExpiry);
  const expiryOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const days = Math.round((expiryOnly - today) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'Rights Expired';
  if (days <= 30) return 'Rights Expiring';
  return 'Licensed';
});

contentSchema.index({ contentType: 1, archived: 1, createdAt: -1 });
contentSchema.index({ status: 1 });

contentSchema.statics.CONTENT_TYPES = CONTENT_TYPES;
contentSchema.statics.STATUSES = STATUSES;
contentSchema.statics.ASSET_CATEGORIES = ASSET_CATEGORIES;
contentSchema.statics.OBJECTION_CATEGORIES = OBJECTION_CATEGORIES;
contentSchema.statics.LEAD_MAGNET_STATUSES = LEAD_MAGNET_STATUSES;

module.exports = mongoose.model('Content', contentSchema);
