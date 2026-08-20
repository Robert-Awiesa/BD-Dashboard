// ============================================
// Blog & Content CMS services.
// Five content types over one polymorphic collection — see models/Content.js.
// Mirrors the shape of documentService.js so the two knowledge modules behave
// the same way from the API down.
// ============================================

const ContentModel = require('../models/Content');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normaliseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// Survey takeaways arrive either as an array of bullets or as one textarea's
// worth of newline-separated lines.
const normaliseTakeaways = (takeaways) => {
  if (Array.isArray(takeaways)) return takeaways.map((t) => String(t).trim()).filter(Boolean);
  if (typeof takeaways === 'string') return takeaways.split('\n').map((t) => t.trim()).filter(Boolean);
  return [];
};

const CONTENT_SORTS = {
  recent: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  title: { title: 1 },
  author: { authorOrUploader: 1, createdAt: -1 },
  status: { status: 1, updatedAt: -1 },
};

const withLinks = (query) =>
  query
    .populate('coverAsset', 'title fileUrl fileType altText')
    .populate('clientLogo', 'title fileUrl fileType altText')
    .populate('caseStudyDoc', 'title fileUrl fileType category');

// ====================
// QUERIES
// ====================

exports.getAllContent = async (filters = {}) => {
  const {
    contentType,
    search,
    tag,
    status,
    categorySector,
    assetCategory,
    objectionCategory,
    leadMagnetStatus,
    includeArchived,
    sort = 'recent',
  } = filters;

  const query = {};
  if (contentType) query.contentType = contentType;
  if (status) query.status = status;
  if (categorySector) query.categorySector = categorySector;
  if (assetCategory) query.assetCategory = assetCategory;
  if (objectionCategory) query.objectionCategory = objectionCategory;
  if (leadMagnetStatus) query.leadMagnetStatus = leadMagnetStatus;
  if (tag) query.tags = tag;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    // Wide on purpose: a rep hunting an objection mid-call searches for the
    // words in the answer, not the title they filed it under.
    query.$or = [
      { title: rx }, { description: rx }, { tags: rx }, { authorOrUploader: rx },
      { contentBody: rx }, { verifiedAnswer: rx }, { clientName: rx },
      { challenge: rx }, { solution: rx }, { quantifiableResults: rx },
      { testimonialQuote: rx }, { keyTakeaways: rx }, { categorySector: rx },
      { altText: rx }, { fileName: rx },
    ];
  }

  const items = await withLinks(
    ContentModel.find(query).sort(CONTENT_SORTS[sort] || CONTENT_SORTS.recent)
  );

  if (sort === 'popular') return items.sort((a, b) => b.engagementScore - a.engagementScore);
  return items;
};

exports.getContentById = async (id) => {
  const item = await withLinks(ContentModel.findById(id));
  if (!item) throw new Error('Content item not found');
  return item;
};

exports.getContentTags = async (contentType) => {
  const query = { archived: { $ne: true } };
  if (contentType) query.contentType = contentType;
  const tags = await ContentModel.distinct('tags', query);
  return tags.filter(Boolean).sort((a, b) => a.localeCompare(b));
};

// Sectors already in use, so the User Story / Article sector filter offers real
// values instead of a free-text box that fragments them.
exports.getContentSectors = async () => {
  const sectors = await ContentModel.distinct('categorySector', { archived: { $ne: true } });
  return sectors.filter(Boolean).sort((a, b) => a.localeCompare(b));
};

exports.getContentAuthors = async () => {
  const [authors, editors] = await Promise.all([
    ContentModel.distinct('authorOrUploader'),
    ContentModel.distinct('lastEditedBy'),
  ]);
  return [...new Set([...authors, ...editors])].filter(Boolean).sort((a, b) => a.localeCompare(b));
};

// The Assets library, for the cover-image and client-logo pickers.
exports.getAssetLibrary = async () => {
  return ContentModel.find({ contentType: 'Asset', archived: { $ne: true } })
    .select('title fileUrl fileType altText assetCategory dimensions')
    .sort({ createdAt: -1 });
};

// ====================
// CREATE / UPDATE
// ====================

const buildPayload = (data) => ({
  contentType: data.contentType,
  title: (data.title || '').trim(),
  description: data.description || '',
  authorOrUploader: data.authorOrUploader,
  lastEditedBy: data.authorOrUploader,
  tags: normaliseTags(data.tags),
  status: data.status || 'Draft',
  scheduledFor: data.scheduledFor || undefined,
  publishedAt: data.status === 'Published' ? new Date() : undefined,

  contentBody: data.contentBody || '',
  categorySector: data.categorySector || '',

  subtitle: data.subtitle || '',
  metaTitle: data.metaTitle || '',
  metaDescription: data.metaDescription || '',
  focusKeyword: data.focusKeyword || '',
  publicUrl: data.publicUrl || '',
  coverAsset: data.coverAsset || undefined,

  assetCategory: data.assetCategory || undefined,
  fileUrl: data.fileUrl || '',
  fileName: data.fileName || '',
  fileType: data.fileType || '',
  fileSize: data.fileSize || '',
  dimensions: data.dimensions || '',
  altText: data.altText || '',
  usageRights: data.usageRights || '',
  usageRightsExpiry: data.usageRightsExpiry || undefined,

  targetAudience: data.targetAudience || '',
  sampleSize: data.sampleSize || '',
  keyTakeaways: normaliseTakeaways(data.keyTakeaways),
  infographicUrl: data.infographicUrl || '',
  leadMagnetStatus: data.leadMagnetStatus || 'Internal Use Only',

  objectionCategory: data.objectionCategory || undefined,
  verifiedAnswer: data.verifiedAnswer || '',
  associatedProduct: data.associatedProduct || '',

  clientName: data.clientName || '',
  challenge: data.challenge || '',
  solution: data.solution || '',
  quantifiableResults: data.quantifiableResults || '',
  testimonialQuote: data.testimonialQuote || '',
  clientLogo: data.clientLogo || undefined,
  caseStudyDoc: data.caseStudyDoc || undefined,
});

// Each content type earns its own required fields — a FAQ with no answer or a
// case study with no client is not a useful record, and catching that here
// keeps the repository trustworthy rather than merely full.
const validateByType = (payload) => {
  if (!payload.contentType) throw new Error('Content type is required');
  if (!payload.title) throw new Error('A title is required');
  if (!payload.authorOrUploader) throw new Error('An author / uploader is required');

  switch (payload.contentType) {
    case 'Article':
      if (!payload.contentBody.trim()) throw new Error('An article needs a body before it can be saved');
      break;
    case 'Asset':
      if (!payload.fileUrl) throw new Error('Upload a file or provide a link for this asset');
      if (!payload.altText.trim()) throw new Error('Alt text is required — it carries the accessibility and SEO value of the asset');
      break;
    case 'Survey':
      if (payload.keyTakeaways.length === 0) throw new Error('Add at least one key takeaway — the takeaways are what get reused');
      break;
    case 'FAQ':
      if (!payload.verifiedAnswer.trim()) throw new Error('A verified answer is required — an unanswered objection helps nobody on a call');
      break;
    case 'UserStory':
      if (!payload.clientName.trim()) throw new Error('A client / project name is required');
      if (!payload.challenge.trim() || !payload.solution.trim()) {
        throw new Error('A case study needs both the challenge and the solution');
      }
      break;
    default:
      break;
  }
};

exports.createContent = async (data) => {
  const payload = buildPayload(data);
  validateByType(payload);
  const created = await ContentModel.create(payload);
  return withLinks(ContentModel.findById(created._id));
};

exports.updateContent = async (id, data) => {
  const existing = await ContentModel.findById(id);
  if (!existing) throw new Error('Content item not found');

  const { _id, viewCount, downloadOrUsageCount, ...updates } = data;
  if (updates.tags !== undefined) updates.tags = normaliseTags(updates.tags);
  if (updates.keyTakeaways !== undefined) updates.keyTakeaways = normaliseTakeaways(updates.keyTakeaways);

  // Empty strings from <select>/<input> must clear a ref, not fail to cast.
  for (const ref of ['coverAsset', 'clientLogo', 'caseStudyDoc']) {
    if (updates[ref] === '') updates[ref] = null;
  }
  for (const date of ['scheduledFor', 'usageRightsExpiry']) {
    if (updates[date] === '') updates[date] = null;
  }

  // Stamp the first transition into Published; later edits keep the original date.
  if (updates.status === 'Published' && existing.status !== 'Published') {
    updates.publishedAt = new Date();
  }

  const merged = { ...existing.toObject(), ...updates };
  validateByType({
    contentType: merged.contentType,
    title: merged.title,
    authorOrUploader: merged.authorOrUploader,
    contentBody: merged.contentBody || '',
    fileUrl: merged.fileUrl || '',
    altText: merged.altText || '',
    keyTakeaways: merged.keyTakeaways || [],
    verifiedAnswer: merged.verifiedAnswer || '',
    clientName: merged.clientName || '',
    challenge: merged.challenge || '',
    solution: merged.solution || '',
  });

  const updated = await withLinks(
    ContentModel.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true })
  );
  return updated;
};

exports.setContentArchived = async (id, archived) => {
  const item = await ContentModel.findByIdAndUpdate(
    id,
    { archived, archivedAt: archived ? new Date() : null },
    { returnDocument: 'after' }
  );
  if (!item) throw new Error('Content item not found');
  return item;
};

// Same rule as the document repository: the workspace is open to everyone, so
// there is no owner check between one mis-click and somebody else's work.
// Archiving is the way out; a hard delete is only reachable once archived.
exports.deleteContent = async (id) => {
  const item = await ContentModel.findById(id);
  if (!item) throw new Error('Content item not found');
  if (!item.archived) {
    throw new Error('Archive this item before deleting it — that keeps it recoverable until someone deliberately discards it.');
  }
  // An asset still used as a cover image or client logo would leave those
  // records pointing at nothing.
  const inUse = await ContentModel.countDocuments({
    $or: [{ coverAsset: id }, { clientLogo: id }],
  });
  if (inUse > 0) {
    throw new Error(`This asset is still used by ${inUse} other item(s). Swap those out before deleting it.`);
  }
  await item.deleteOne();
  return item;
};

// ====================
// ENGAGEMENT
// ====================

const recordUse = async (id, field, actor) => {
  const item = await ContentModel.findByIdAndUpdate(
    id,
    { $inc: { [field]: 1 }, $set: { lastUsedAt: new Date(), lastUsedBy: actor || '' } },
    { returnDocument: 'after' }
  );
  if (!item) throw new Error('Content item not found');
  return item;
};

exports.recordContentView = (id, actor) => recordUse(id, 'viewCount', actor);
exports.recordContentUsage = (id, actor) => recordUse(id, 'downloadOrUsageCount', actor);

// ====================
// DASHBOARD STATS
// ====================

exports.getContentStats = async () => {
  const items = await ContentModel.find({ archived: { $ne: true } }).select(
    'title contentType status viewCount downloadOrUsageCount lastUsedAt usageRightsExpiry scheduledFor categorySector authorOrUploader createdAt'
  );

  const perType = {};
  for (const type of ContentModel.CONTENT_TYPES) {
    perType[type] = { total: 0, drafts: 0, review: 0, scheduled: 0, published: 0, views: 0, usage: 0 };
  }

  const rightsAlerts = [];
  for (const item of items) {
    const bucket = perType[item.contentType];
    if (!bucket) continue;
    bucket.total += 1;
    bucket.views += item.viewCount || 0;
    bucket.usage += item.downloadOrUsageCount || 0;
    if (item.status === 'Draft') bucket.drafts += 1;
    if (item.status === 'Ready for Review') bucket.review += 1;
    if (item.status === 'Scheduled') bucket.scheduled += 1;
    if (item.status === 'Published') bucket.published += 1;
    if (item.rightsStatus === 'Rights Expired' || item.rightsStatus === 'Rights Expiring') {
      rightsAlerts.push(item);
    }
  }

  const byEngagement = [...items].sort((a, b) => b.engagementScore - a.engagementScore);
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);

  return {
    perType,
    totals: {
      items: items.length,
      drafts: items.filter((i) => i.status === 'Draft').length,
      awaitingReview: items.filter((i) => i.status === 'Ready for Review').length,
      scheduled: items.filter((i) => i.status === 'Scheduled').length,
      published: items.filter((i) => i.status === 'Published').length,
      totalViews: items.reduce((s, i) => s + (i.viewCount || 0), 0),
      totalUsage: items.reduce((s, i) => s + (i.downloadOrUsageCount || 0), 0),
      rightsAlerts: rightsAlerts.length,
    },
    topPerforming: byEngagement.filter((i) => i.engagementScore > 0).slice(0, 5),
    recentlyUsed: byEngagement.filter((i) => i.lastUsedAt && i.lastUsedAt >= thirtyDaysAgo).slice(0, 5),
    // The editorial queue — what is waiting on a person right now.
    awaitingReview: items
      .filter((i) => i.status === 'Ready for Review')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, 8),
    rightsAlerts: rightsAlerts
      .sort((a, b) => new Date(a.usageRightsExpiry) - new Date(b.usageRightsExpiry))
      .slice(0, 8),
  };
};
