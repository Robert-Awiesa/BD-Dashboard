// Tenders & EOI vocabulary. Mirrors the enums in Server/models/Tender.js and
// Server/models/Eoi.js. The forms and badges read from here so they never drift
// from the Mongoose schema.

export const TENDER_TYPES = ['Stage One', 'Stage Two', 'Single Stage'];

export const TENDER_STATUSES = ['Open', 'In Progress', 'Submitted', 'Won', 'Lost'];

export const EOI_STATUSES = ['Open', 'Submitted', 'Under Review', 'Closed'];

export const SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Other'];

// Badge tone per status, shared by both tabs.
export const STATUS_BADGE = {
  Open: 'active',
  'In Progress': 'ongoing',
  Submitted: 'Demo',
  'Under Review': 'Negotiation',
  Won: 'success',
  Closed: 'cold',
  Lost: 'danger',
};

export const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
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

export const SOURCE_LABEL = (source, detail) =>
  source === 'Other' && detail ? `Other · ${detail}` : source || '—';

export const emptyTenderForm = {
  title: '',
  reference: '',
  source: '',
  sourceDetail: '',
  issuingAuthority: '',
  tenderType: 'Stage One',
  deadline: '',
  status: 'Open',
  estimatedValue: '',
  pdp: { objectives: '', milestones: [], individuals: [], progress: 0, notes: '' },
  fdp: { currency: '', estimatedCost: '', proposedPrice: '', marginPct: '', pricingModel: '', assumptions: '', notes: '' },
  notes: '',
};

export const emptyEoiForm = {
  title: '',
  reference: '',
  source: '',
  sourceDetail: '',
  issuingAuthority: '',
  deadline: '',
  status: 'Open',
  attachmentType: '',
  attachmentUrl: '',
  attachmentFileName: '',
  notes: '',
};
