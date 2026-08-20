const mongoose = require('mongoose');

const CATEGORIES = [
  'Sales Talking Points',
  'Learning Materials',
  'Monthly Reports',
  'Market Research',
  'Industry Trends',
  'Memos',
];

const ACCESS_LEVELS = ['All Team', 'Management Only', 'Sales Department Only'];

// 'file' = an uploaded/linked artefact (PDF, DOCX, XLSX...).
// 'memo' = a document authored natively in the dashboard as markdown.
const DOC_KINDS = ['file', 'memo'];

const PUBLISH_STATUSES = ['Draft', 'Published'];

// Categories that can hold natively-authored memos. Uploading a file is
// allowed everywhere; writing one in-app is deliberately scoped to the two
// categories that are actually drafted rather than received.
const MEMO_CATEGORIES = ['Memos', 'Sales Talking Points'];

// Snapshot of a document as it stood *before* it was superseded. Pushed on
// every "Upload New Version" / memo re-publish, so the repository holds one
// row per document instead of Report-Q3-final-FINAL-v2.pdf.
const versionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' },
    fileSize: { type: String, default: '' },
    body: { type: String, default: '' }, // markdown snapshot for memos
    changeNote: { type: String, default: '' },
    savedBy: { type: String, default: '' },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, default: '' },

    kind: { type: String, enum: DOC_KINDS, default: 'file' },

    // --- File-backed documents ---
    fileUrl: { type: String, default: '' }, // local /uploads/documents/... or external URL
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' }, // PDF, DOCX, XLSX, PPTX, MP4...
    fileSize: { type: String, default: '' }, // human-readable, e.g. "2.4 MB"

    // --- Natively authored memos (Feature 2) ---
    body: { type: String, default: '' }, // markdown source
    publishStatus: { type: String, enum: PUBLISH_STATUSES, default: 'Published' },

    uploadedBy: { type: String, required: true },
    lastEditedBy: { type: String, default: '' },

    version: { type: String, default: '1.0' },
    versionHistory: [versionSchema],

    tags: [{ type: String }],
    accessLevel: { type: String, enum: ACCESS_LEVELS, default: 'All Team' },

    // --- Lifecycle management (Feature 3) ---
    reviewDate: { type: Date },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },

    // --- Cross-module linking ---
    linkedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    linkedEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },

    // --- Engagement tracking (Feature 4) ---
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date },
    lastAccessedBy: { type: String, default: '' },

    // --- Collaboration (Feature 2) ---
    comments: [commentSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Days until the review date falls due. Negative once it has passed.
documentSchema.virtual('daysToReview').get(function () {
  if (!this.reviewDate) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(this.reviewDate);
  const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueOnly - today) / MS_PER_DAY);
});

// Drives the badge on every document card. Computed rather than stored so a
// document becomes stale on its own, without waiting for the nightly sweep.
documentSchema.virtual('reviewStatus').get(function () {
  if (this.archived) return 'Archived';
  if (!this.reviewDate) return 'No Review Date';
  const days = this.daysToReview;
  if (days < 0) return 'Review Needed';
  if (days <= 14) return 'Review Soon';
  return 'Current';
});

// Cheap relevance signal for the "most used" panels: a download is a stronger
// signal of usefulness than a glance, so it is weighted heavier than a view.
documentSchema.virtual('engagementScore').get(function () {
  return (this.viewCount || 0) + (this.downloadCount || 0) * 3;
});

documentSchema.index({ category: 1, archived: 1, createdAt: -1 });
documentSchema.index({ title: 'text', description: 'text', tags: 'text' });

documentSchema.statics.CATEGORIES = CATEGORIES;
documentSchema.statics.ACCESS_LEVELS = ACCESS_LEVELS;
documentSchema.statics.DOC_KINDS = DOC_KINDS;
documentSchema.statics.PUBLISH_STATUSES = PUBLISH_STATUSES;
documentSchema.statics.MEMO_CATEGORIES = MEMO_CATEGORIES;

module.exports = mongoose.model('Document', documentSchema);
