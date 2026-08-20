// Shared vocabulary for the Reports & Documentation hub.
// The category / access-level lists mirror the enums in Server/models/Document.js —
// the live values are also served from /api/documents/meta, which the module
// fetches on mount so a schema change surfaces without a frontend edit.

export const CATEGORIES = [
  {
    id: 'Sales Talking Points',
    icon: '🎯',
    blurb: 'Objection handling, positioning and pitch scripts the team works from.',
    accent: 'navy',
  },
  {
    id: 'Learning Materials',
    icon: '🎓',
    blurb: 'Onboarding decks, product training and internal enablement resources.',
    accent: 'forest',
  },
  {
    id: 'Monthly Reports',
    icon: '📈',
    blurb: 'Performance reporting, board packs and recurring management summaries.',
    accent: 'sky',
  },
  {
    id: 'Market Research',
    icon: '🔍',
    blurb: 'Sector sizing, competitor teardowns and commissioned research.',
    accent: 'violet',
  },
  {
    id: 'Industry Trends',
    icon: '📡',
    blurb: 'Signals, regulatory shifts and outlook pieces worth circulating.',
    accent: 'amber',
  },
  {
    id: 'Memos',
    icon: '📝',
    blurb: 'Internal notes, decisions and policy communications written in-app.',
    accent: 'orange',
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const ACCESS_LEVELS = ['All Team', 'Management Only', 'Sales Department Only'];

// The workspace is open to every team member by design, so this field flags how
// a document should be *handled* — it is not a permission boundary. Said plainly
// on the forms, so nobody files a sensitive memo believing it is locked down.
export const ACCESS_LEVEL_NOTE =
  'Handling guidance, not a lock — the workspace is open to the whole team, so this flags how sensitive the document is rather than restricting who can open it.';

export const PUBLISH_STATUSES = ['Draft', 'Published'];

// Writing a document in-app is scoped to the two categories that are drafted
// rather than received. Everything else arrives as a file from elsewhere.
export const MEMO_CATEGORIES = ['Memos', 'Sales Talking Points'];

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title (A–Z)' },
  { id: 'author', label: 'Author (A–Z)' },
  { id: 'popular', label: 'Most used' },
  { id: 'review', label: 'Review date' },
];

export const REVIEW_STATUSES = ['Review Needed', 'Review Soon', 'Current', 'No Review Date'];

export const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.mp4',
];

// Maps onto the shared Badge component's status keys.
export const REVIEW_BADGE_STATUS = {
  'Review Needed': 'danger',
  'Review Soon': 'ongoing',
  Current: 'success',
  'No Review Date': 'default',
  Archived: 'cold',
};

export const ACCESS_BADGE_STATUS = {
  'All Team': 'default',
  'Management Only': 'danger',
  'Sales Department Only': 'active',
};

const FILE_ICONS = {
  PDF: '📕',
  DOC: '📘', DOCX: '📘',
  XLS: '📗', XLSX: '📗', CSV: '📗',
  PPT: '📙', PPTX: '📙',
  MP4: '🎬',
  TXT: '📄', MD: '📄',
};

export const fileIconFor = (doc) => {
  if (!doc) return '📄';
  if (doc.kind === 'memo') return '📝';
  return FILE_ICONS[(doc.fileType || '').toUpperCase()] || '📎';
};

export const categoryMeta = (id) =>
  CATEGORIES.find((c) => c.id === id) || { id, icon: '📄', blurb: '', accent: 'navy' };

// Tailwind can't build class names at runtime, so each accent's classes are
// written out in full for the compiler to see.
export const ACCENT_CLASSES = {
  navy: { tile: 'bg-navy-50 text-navy-700', ring: 'group-hover:border-navy-300' },
  forest: { tile: 'bg-forest-50 text-forest-700', ring: 'group-hover:border-forest-300' },
  sky: { tile: 'bg-sky-50 text-sky-700', ring: 'group-hover:border-sky-300' },
  violet: { tile: 'bg-violet-50 text-violet-700', ring: 'group-hover:border-violet-300' },
  amber: { tile: 'bg-amber-50 text-amber-700', ring: 'group-hover:border-amber-300' },
  orange: { tile: 'bg-orange-50 text-orange-700', ring: 'group-hover:border-orange-300' },
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// Offsets used by the "set review date" shortcuts on the upload form —
// research goes stale on a predictable cadence, so the common windows are
// one click rather than a calendar hunt.
export const REVIEW_PRESETS = [
  { label: '+3 months', months: 3 },
  { label: '+6 months', months: 6 },
  { label: '+12 months', months: 12 },
];

export const dateFromMonthsAhead = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

// The review lifecycle only fires if a date gets set, and the premise of the
// feature is that people forget documents go stale — so leaving it blank by
// default guarantees it stays dormant. Each category gets the shelf life its
// content actually has, and the uploader can always override or clear it.
// Memos are deliberately null: a memo records a decision at a point in time,
// so it becomes history rather than going out of date.
export const CATEGORY_REVIEW_DEFAULTS = {
  'Market Research': 6,
  'Industry Trends': 6,
  'Sales Talking Points': 6,
  'Monthly Reports': 12,
  'Learning Materials': 12,
  Memos: null,
};

export const defaultReviewDateFor = (category) => {
  const months = CATEGORY_REVIEW_DEFAULTS[category];
  return months ? dateFromMonthsAhead(months) : '';
};

export const emptyDocumentForm = {
  title: '',
  category: CATEGORY_IDS[0],
  description: '',
  fileUrl: '',
  fileName: '',
  fileType: '',
  fileSize: '',
  accessLevel: 'All Team',
  version: '1.0',
  reviewDate: '',
  tags: [],
  linkedCampaign: '',
  linkedEvent: '',
};

export const emptyMemoForm = {
  title: '',
  category: 'Memos',
  body: '',
  description: '',
  accessLevel: 'All Team',
  publishStatus: 'Draft',
  reviewDate: '',
  tags: [],
  linkedCampaign: '',
  linkedEvent: '',
};
