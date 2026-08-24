// Tenders & EOI vocabulary. Mirrors the enums in Server/models/Tender.js and
// Server/models/Eoi.js — which now actually enforce them, so a value that is
// not here will be rejected by the API rather than quietly stored.

// How the buyer is running the procurement, which decides who may bid.
export const TENDER_TYPES = ['Opened', 'Restrictive', 'Negotiated'];

// The same list Cold Calls uses, so a sector means the same thing in both.
export const SECTORS = ['Oil and Gas', 'Manufacturing', 'Mining', 'Logistics', 'Financial', 'Others'];

// Every source has to say how to get BACK to the tender. Mirrors
// Tender.SOURCE_REQUIREMENTS on the server, which enforces it.
export const SOURCE_REQUIREMENTS = {
  Newspaper: { field: 'sourceImageUrl', kind: 'image', label: 'Photo or scan of the notice' },
  Website: { field: 'sourceLink', kind: 'url', label: 'Link to the tender' },
  WhatsApp: { field: 'sourceImageUrl', kind: 'image', label: 'Screenshot of the message' },
  Email: { field: 'sourceDetail', kind: 'text', label: 'Who sent it, and the subject line' },
  Meeting: { field: 'sourceDetail', kind: 'text', label: 'Who mentioned it, and where' },
  Referral: { field: 'sourceDetail', kind: 'text', label: 'Who referred it' },
  Other: { field: 'sourceDetail', kind: 'text', label: 'Where did this come from?' },
};

export const TENDER_STATUSES = [
  'Open', 'In Progress', 'Submitted', 'Won', 'Lost', 'No Bid', 'Withdrawn',
];

export const EOI_STATUSES = ['Open', 'Submitted', 'Under Review', 'Closed'];

export const DECISIONS = ['Undecided', 'Pursue', 'Pass'];

export const SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Referral', 'Other'];

// The human decision.
export const STATUS_BADGE = {
  Open: 'active',
  'In Progress': 'ongoing',
  Submitted: 'Demo',
  'Under Review': 'Negotiation',
  Won: 'success',
  Lost: 'danger',
  'No Bid': 'cold',
  Withdrawn: 'cold',
  Closed: 'cold',
};

// The automated tag, derived from the clock rather than typed by anyone.
export const DEADLINE_BADGE = {
  Overdue: 'danger',
  'Due Today': 'danger',
  'Closing Soon': 'ongoing',
  Upcoming: 'active',
  Scheduled: 'default',
  'No Deadline': 'cold',
  Decided: 'success',
  Archived: 'cold',
};

export const DECISION_BADGE = {
  Undecided: 'ongoing',
  Pursue: 'success',
  Pass: 'cold',
};

// The filter bar the blueprint asks for. `view` values are understood by the
// API; `status` values filter on the stored decision.
export const TENDER_VIEWS = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Live' },
  { id: 'closing', label: 'Closing soon' },
  { id: 'missed', label: 'Missed' },
];

export const EOI_VIEWS = [
  { id: '', label: 'All' },
  { id: 'awaiting', label: 'Awaiting decision' },
];

export const SORT_OPTIONS = [
  { id: 'deadline', label: 'Deadline (soonest)' },
  { id: 'value', label: 'Value (highest)' },
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Title (A–Z)' },
  { id: 'recent', label: 'Recently added' },
];

export const formatMoney = (value, currency = '') => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return '—';
  const prefix = currency ? `${currency} ` : '';
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${Math.round(n / 1_000)}K`;
  return `${prefix}${n}`;
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

// Deadlines are the point of this module, so they read in human terms.
export const deadlineLabel = (days) => {
  if (days === null || days === undefined) return 'no deadline';
  if (days === 0) return 'due TODAY';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day overdue';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days overdue`;
};

export const SOURCE_LABEL = (source, detail) =>
  source === 'Other' && detail ? `Other · ${detail}` : source || '—';

export const SECTOR_LABEL = (sector, custom) =>
  sector === 'Others' && custom ? custom : sector || '';

export const emptyTenderForm = {
  title: '',
  reference: '',
  source: 'Other',
  sourceDetail: '',
  sourceLink: '',
  sourceImageUrl: '',
  sourceImageName: '',
  issuingAuthority: '',
  sector: '',
  customSector: '',
  tenderType: 'Opened',
  openedDate: '',
  deadline: '',
  status: 'Open',
  owner: '',
  estimatedValue: '',
  currency: '',
  tags: [],
  pdp: { objectives: '', proposedSolution: '', milestones: [], individuals: [], progress: 0, notes: '' },
  fdp: { currency: '', estimatedCost: '', proposedPrice: '', marginPct: '', pricingModel: '', assumptions: '', notes: '' },
  notes: '',
};

export const emptyEoiForm = {
  title: '',
  reference: '',
  source: 'Other',
  sourceDetail: '',
  issuingAuthority: '',
  sector: '',
  deadline: '',
  status: 'Open',
  owner: '',
  decision: 'Undecided',
  decisionReason: '',
  attachmentType: '',
  attachmentUrl: '',
  attachmentFileName: '',
  tags: [],
  notes: '',
};
