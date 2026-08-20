// Shared vocabulary for the Blog & Content CMS.
// Mirrors the enums in Server/models/Content.js; the live values are also
// served from /api/content/meta.

export const CONTENT_TYPES = [
  {
    id: 'Article',
    label: 'Articles',
    icon: '📰',
    accent: 'navy',
    blurb: 'Long-form insight and thought leadership that positions us as the industry authority.',
    purpose: 'SEO & inbound lead generation',
  },
  {
    id: 'Asset',
    label: 'Images & Assets',
    icon: '🖼️',
    accent: 'violet',
    blurb: 'Central brand library — logos, product graphics, banners and media kits.',
    purpose: 'Reusable, rights-cleared collateral',
  },
  {
    id: 'Survey',
    label: 'Survey Results',
    icon: '📊',
    accent: 'sky',
    blurb: 'Market intelligence, poll findings and the infographics built from them.',
    purpose: 'Lead magnets & citable data',
  },
  {
    id: 'FAQ',
    label: 'FAQ',
    icon: '💬',
    accent: 'amber',
    blurb: 'Verified answers to the objections that come up on live calls.',
    purpose: 'Objection handling & sales enablement',
  },
  {
    id: 'UserStory',
    label: 'User Stories',
    icon: '🏆',
    accent: 'forest',
    blurb: 'Client transformation narratives with quantifiable results and testimonials.',
    purpose: 'Social proof for closing deals',
  },
];

export const CONTENT_TYPE_IDS = CONTENT_TYPES.map((t) => t.id);

export const STATUSES = ['Draft', 'Ready for Review', 'Scheduled', 'Published'];

export const ASSET_CATEGORIES = [
  'Brand Logo', 'Product Graphic', 'Event Photo', 'Banner', 'Media Kit', 'Other',
];

export const OBJECTION_CATEGORIES = ['Pricing', 'Technical Integration', 'Security', 'General'];

export const LEAD_MAGNET_STATUSES = ['Internal Use Only', 'Public Release'];

export const ACCEPTED_ASSET_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.pdf',
];

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title (A–Z)' },
  { id: 'author', label: 'Author (A–Z)' },
  { id: 'status', label: 'Workflow status' },
  { id: 'popular', label: 'Most used' },
];

// Maps onto the shared Badge component's status keys.
export const STATUS_BADGE = {
  Draft: 'cold',
  'Ready for Review': 'ongoing',
  Scheduled: 'Demo',
  Published: 'success',
};

export const RIGHTS_BADGE = {
  'Rights Expired': 'danger',
  'Rights Expiring': 'ongoing',
  Licensed: 'success',
  Unrestricted: 'default',
};

// Tailwind cannot build class names at runtime, so each accent is spelled out.
export const ACCENT_CLASSES = {
  navy: { tile: 'bg-navy-50 text-navy-700', ring: 'group-hover:border-navy-300' },
  forest: { tile: 'bg-forest-50 text-forest-700', ring: 'group-hover:border-forest-300' },
  sky: { tile: 'bg-sky-50 text-sky-700', ring: 'group-hover:border-sky-300' },
  violet: { tile: 'bg-violet-50 text-violet-700', ring: 'group-hover:border-violet-300' },
  amber: { tile: 'bg-amber-50 text-amber-700', ring: 'group-hover:border-amber-300' },
};

// One form object covers all five types, which means it always holds defaults
// for fields the current type has no use for. Saving it wholesale would stamp
// an FAQ with assetCategory: 'Product Graphic' and a survey's lead-magnet
// status onto an article — junk that then shows up in the detail view. So the
// payload is filtered to the fields the selected type actually owns.
const COMMON_FIELDS = ['contentType', 'title', 'description', 'tags', 'status', 'scheduledFor'];

export const TYPE_FIELDS = {
  Article: [
    'subtitle', 'categorySector', 'contentBody',
    'metaTitle', 'metaDescription', 'focusKeyword', 'publicUrl', 'coverAsset',
  ],
  Asset: [
    'assetCategory', 'fileUrl', 'fileName', 'fileType', 'fileSize',
    'dimensions', 'altText', 'usageRights', 'usageRightsExpiry',
  ],
  Survey: ['targetAudience', 'sampleSize', 'keyTakeaways', 'infographicUrl', 'leadMagnetStatus'],
  FAQ: ['objectionCategory', 'verifiedAnswer', 'associatedProduct'],
  UserStory: [
    'categorySector', 'contentBody', 'clientName', 'challenge', 'solution',
    'quantifiableResults', 'testimonialQuote', 'clientLogo', 'caseStudyDoc',
  ],
};

export const pickFieldsForType = (form) => {
  const allowed = new Set([...COMMON_FIELDS, ...(TYPE_FIELDS[form.contentType] || [])]);
  return Object.fromEntries(Object.entries(form).filter(([key]) => allowed.has(key)));
};

export const typeMeta = (id) =>
  CONTENT_TYPES.find((t) => t.id === id) || { id, label: id, icon: '📄', accent: 'navy', blurb: '' };

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

const IMAGE_TYPES = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'];
export const isImageAsset = (item) =>
  item?.contentType === 'Asset' && IMAGE_TYPES.includes((item.fileType || '').toUpperCase());

export const isVideoAsset = (item) =>
  item?.contentType === 'Asset' && ['MP4', 'WEBM'].includes((item.fileType || '').toUpperCase());

// One blank form covering every type; the modal shows only the fields that
// belong to the selected contentType, so a single shape keeps state simple.
export const emptyContentForm = {
  contentType: 'Article',
  title: '',
  subtitle: '',
  description: '',
  tags: [],
  status: 'Draft',
  scheduledFor: '',

  contentBody: '',
  categorySector: '',

  metaTitle: '',
  metaDescription: '',
  focusKeyword: '',
  publicUrl: '',
  coverAsset: '',

  assetCategory: 'Product Graphic',
  fileUrl: '',
  fileName: '',
  fileType: '',
  fileSize: '',
  dimensions: '',
  altText: '',
  usageRights: '',
  usageRightsExpiry: '',

  targetAudience: '',
  sampleSize: '',
  keyTakeaways: '',
  infographicUrl: '',
  leadMagnetStatus: 'Internal Use Only',

  objectionCategory: 'Pricing',
  verifiedAnswer: '',
  associatedProduct: '',

  clientName: '',
  challenge: '',
  solution: '',
  quantifiableResults: '',
  testimonialQuote: '',
  clientLogo: '',
  caseStudyDoc: '',
};
