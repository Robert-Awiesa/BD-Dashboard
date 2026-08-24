// ============================================
// Reports & Documentation hub services.
// Kept out of bdService.js — this is a self-contained subsystem (repository,
// version history, review lifecycle, engagement analytics), so it follows the
// same pattern as reminderEngine.js rather than growing the shared service.
// ============================================

const DocumentModel = require('../models/Document');
const lookups = require('./lookups');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REVIEW_SOON_WINDOW_DAYS = 14;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// "1.0" -> "1.1", "1.9" -> "1.10", "2" -> "2.1". Any tag that isn't
// dot-numeric just gains a minor segment, so a hand-typed version like
// "Draft-A" still advances instead of throwing.
const bumpVersion = (current) => {
  const raw = String(current || '1.0').trim();
  const dotted = raw.match(/^(\d+)\.(\d+)$/);
  if (dotted) return dotted[1] + '.' + (Number(dotted[2]) + 1);
  const whole = raw.match(/^(\d+)$/);
  if (whole) return whole[1] + '.1';
  return raw + '.1';
};

// The upload form sends tags as a comma-separated string; the API also accepts
// a real array so bulk imports don't have to re-join them.
const normaliseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// Mongo can not sort on the `engagementScore` virtual, so popularity ordering
// is applied in memory after the query. Every other sort runs in the database.
const DOCUMENT_SORTS = {
  recent: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  title: { title: 1 },
  author: { uploadedBy: 1, createdAt: -1 },
  review: { reviewDate: 1 },
};

const withLinks = (query) =>
  query
    .populate('linkedCampaign', 'campaignName')
    .populate('linkedEvent', 'title startDate');

// ====================
// REPOSITORY QUERIES
// ====================

exports.getAllDocuments = async (filters = {}) => {
  const {
    category,
    search,
    tag,
    accessLevel,
    kind,
    publishStatus,
    reviewStatus,
    includeArchived,
    sort = 'recent',
  } = filters;

  const query = {};
  if (category) query.category = category;
  if (accessLevel) query.accessLevel = accessLevel;
  if (kind) query.kind = kind;
  if (publishStatus) query.publishStatus = publishStatus;
  if (tag) query.tags = tag;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    // Regex rather than $text so partial words match as the user types.
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    // `body` is included so live memos are searchable by their content — for
    // natively-authored documents the text is the document.
    query.$or = [
      { title: rx }, { description: rx }, { tags: rx },
      { uploadedBy: rx }, { fileName: rx }, { body: rx },
    ];
  }

  const today = startOfToday();
  const soonCutoff = new Date(today.getTime() + REVIEW_SOON_WINDOW_DAYS * MS_PER_DAY);
  if (reviewStatus === 'Review Needed') {
    query.reviewDate = { $lt: today };
  } else if (reviewStatus === 'Review Soon') {
    query.reviewDate = { $gte: today, $lte: soonCutoff };
  } else if (reviewStatus === 'Current') {
    query.reviewDate = { $gt: soonCutoff };
  }

  const docs = await withLinks(
    DocumentModel.find(query).sort(DOCUMENT_SORTS[sort] || DOCUMENT_SORTS.recent)
  );

  if (sort === 'popular') return docs.sort((a, b) => b.engagementScore - a.engagementScore);
  return docs;
};

exports.getDocumentById = async (id) => {
  const doc = await withLinks(DocumentModel.findById(id));
  if (!doc) throw new Error('Document not found');
  return doc;
};

// Everyone who has filed or edited something, so the "active team member"
// picker can offer real names instead of a free-text box. Without auth this
// name *is* the attribution, and free text fragments it — Robert / robert /
// Rob T. quietly become three different authors.
exports.getDocumentAuthors = async () => {
  const [uploaders, editors] = await Promise.all([
    DocumentModel.distinct('uploadedBy'),
    DocumentModel.distinct('lastEditedBy'),
  ]);
  return [...new Set([...uploaders, ...editors])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

// Every distinct tag in use, for the repository filter chips.
exports.getDocumentTags = async (category) => {
  const query = { archived: { $ne: true } };
  if (category) query.category = category;
  return lookups.tidy([await DocumentModel.distinct('tags', query)]);
};

// ====================
// CREATE / UPDATE
// ====================

const buildPayload = (data) => {
  const kind = data.kind === 'memo' ? 'memo' : 'file';
  return {
    title: (data.title || '').trim(),
    category: data.category,
    description: data.description || '',
    kind,
    fileUrl: data.fileUrl || '',
    fileName: data.fileName || '',
    fileType: data.fileType || '',
    fileSize: data.fileSize || '',
    body: data.body || '',
    // A file is live the moment it lands; only memos carry a draft state.
    publishStatus: kind === 'memo' ? data.publishStatus || 'Draft' : 'Published',
    uploadedBy: data.uploadedBy,
    lastEditedBy: data.uploadedBy,
    version: data.version || '1.0',
    tags: normaliseTags(data.tags),
    accessLevel: data.accessLevel || 'All Team',
    reviewDate: data.reviewDate || undefined,
    linkedCampaign: data.linkedCampaign || undefined,
    linkedEvent: data.linkedEvent || undefined,
  };
};

exports.createDocument = async (data) => {
  const payload = buildPayload(data);
  if (!payload.title) throw new Error('Document title is required');
  if (!payload.category) throw new Error('Category is required');
  if (!payload.uploadedBy) throw new Error('An uploader / author is required');
  if (payload.kind === 'file' && !payload.fileUrl) {
    throw new Error('A file attachment or document link is required');
  }
  if (payload.kind === 'memo' && !payload.body.trim()) {
    throw new Error('A memo needs some content before it can be saved');
  }
  const created = await DocumentModel.create(payload);
  return withLinks(DocumentModel.findById(created._id));
};

// Metadata-only edit. Content changes that should leave a trail go through
// addDocumentVersion instead, so the history stays meaningful.
exports.updateDocument = async (id, data) => {
  const { _id, versionHistory, comments, viewCount, downloadCount, ...updates } = data;
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);
  if (updates.reviewDate === '') updates.reviewDate = null;
  if (updates.linkedCampaign === '') updates.linkedCampaign = null;
  if (updates.linkedEvent === '') updates.linkedEvent = null;

  const updated = await withLinks(
    DocumentModel.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true })
  );
  if (!updated) throw new Error('Document not found');
  return updated;
};

// "Upload New Version": snapshot what is live now into history, overwrite the
// record, then advance the version tag. One row per document, not one per
// revision — which is the whole point of the feature.
exports.addDocumentVersion = async (id, data) => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('Document not found');

  doc.versionHistory.push({
    version: doc.version,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    body: doc.body,
    changeNote: data.changeNote || '',
    savedBy: doc.lastEditedBy || doc.uploadedBy,
    savedAt: doc.updatedAt || new Date(),
  });

  if (doc.kind === 'file') {
    if (!data.fileUrl) throw new Error('A replacement file or link is required for a new version');
    doc.fileUrl = data.fileUrl;
    doc.fileName = data.fileName || doc.fileName;
    doc.fileType = data.fileType || doc.fileType;
    doc.fileSize = data.fileSize || '';
  } else {
    if (data.body === undefined) throw new Error('Memo content is required for a new version');
    doc.body = data.body;
    if (data.publishStatus) doc.publishStatus = data.publishStatus;
  }

  doc.version = data.version || bumpVersion(doc.version);
  doc.lastEditedBy = data.savedBy || doc.lastEditedBy;
  if (data.description !== undefined) doc.description = data.description;
  if (data.reviewDate !== undefined) doc.reviewDate = data.reviewDate || null;

  await doc.save();
  return withLinks(DocumentModel.findById(doc._id));
};

// The workspace is open to the whole team, so there is no owner check standing
// between one person and everybody else's work. Archiving must therefore be the
// route out of the repository, and a hard delete — which takes the version
// history with it — is only reachable for something already archived.
// The rule lives here rather than only in the UI so it holds for any caller.
exports.deleteDocument = async (id) => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('Document not found');
  if (!doc.archived) {
    throw new Error('Archive this document before deleting it — that keeps its version history recoverable until someone deliberately discards it.');
  }
  await doc.deleteOne();
  return doc;
};

// Soft-retire rather than delete — a superseded market-research report still
// has to be auditable after it drops out of the active repository.
exports.setDocumentArchived = async (id, archived) => {
  const doc = await DocumentModel.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!doc) throw new Error('Document not found');
  return doc;
};

// ====================
// ENGAGEMENT TRACKING (Feature 4)
// ====================

// $inc so two readers opening the same file at once can not clobber each
// other's counts.
const recordAccess = async (id, field, viewer) => {
  const doc = await DocumentModel.findByIdAndUpdate(
    id,
    { $inc: { [field]: 1 }, $set: { lastAccessedAt: new Date(), lastAccessedBy: viewer || '' } },
    { returnDocument: 'after' }
  );
  if (!doc) throw new Error('Document not found');
  return doc;
};

exports.recordDocumentView = (id, viewer) => recordAccess(id, 'viewCount', viewer);
exports.recordDocumentDownload = (id, viewer) => recordAccess(id, 'downloadCount', viewer);

// ====================
// COLLABORATION (Feature 2)
// ====================

exports.addDocumentComment = async (id, comment) => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('Document not found');
  const body = (comment && comment.body ? comment.body : '').trim();
  if (!body) throw new Error('Comment cannot be empty');
  doc.comments.push({ author: comment.author || 'Unknown', body });
  await doc.save();
  return doc;
};

exports.deleteDocumentComment = async (id, commentId) => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('Document not found');
  const comment = doc.comments.id(commentId);
  if (!comment) throw new Error('Comment not found');
  comment.deleteOne();
  await doc.save();
  return doc;
};

// ====================
// WORKSPACE ANALYTICS (Feature 4)
// ====================

exports.getDocumentStats = async () => {
  const docs = await DocumentModel.find({ archived: { $ne: true } }).select(
    'title category kind viewCount downloadCount lastAccessedAt lastAccessedBy reviewDate uploadedBy publishStatus createdAt'
  );

  const perCategory = {};
  for (const category of DocumentModel.CATEGORIES) {
    perCategory[category] = { total: 0, reviewNeeded: 0, drafts: 0, views: 0, downloads: 0 };
  }

  const reviewNeeded = [];
  for (const doc of docs) {
    const bucket = perCategory[doc.category];
    if (!bucket) continue;
    bucket.total += 1;
    bucket.views += doc.viewCount || 0;
    bucket.downloads += doc.downloadCount || 0;
    if (doc.publishStatus === 'Draft') bucket.drafts += 1;
    if (doc.reviewStatus === 'Review Needed') {
      bucket.reviewNeeded += 1;
      reviewNeeded.push(doc);
    }
  }

  const byEngagement = [...docs].sort((a, b) => b.engagementScore - a.engagementScore);
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);

  return {
    perCategory,
    totals: {
      documents: docs.length,
      files: docs.filter((d) => d.kind === 'file').length,
      memos: docs.filter((d) => d.kind === 'memo').length,
      drafts: docs.filter((d) => d.publishStatus === 'Draft').length,
      reviewNeeded: reviewNeeded.length,
      totalViews: docs.reduce((sum, d) => sum + (d.viewCount || 0), 0),
      totalDownloads: docs.reduce((sum, d) => sum + (d.downloadCount || 0), 0),
    },
    // "Most Popular Learning Materials" / "Trending Market Research" panels.
    mostUsed: byEngagement.filter((d) => d.engagementScore > 0).slice(0, 5),
    trending: byEngagement.filter((d) => d.lastAccessedAt && d.lastAccessedAt >= thirtyDaysAgo).slice(0, 5),
    reviewNeeded: reviewNeeded.sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate)).slice(0, 8),
  };
};

exports.bumpVersion = bumpVersion;
exports.REVIEW_SOON_WINDOW_DAYS = REVIEW_SOON_WINDOW_DAYS;
