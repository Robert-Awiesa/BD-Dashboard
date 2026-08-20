// Proposals vocabulary. Mirrors the enums in Server/models/Proposal.js.
//
// These are client-facing bids. Not to be confused with DgEvent.proposals[],
// which are internal session/budget ideas submitted by staff for the annual
// event — same word, different object, deliberately kept apart.

export const ORIGINS = [
  'RFP / Requested',
  'Tender / EOI',
  'Unsolicited Pitch',
  'Renewal',
  'Expansion',
];

export const STAGES = [
  'Drafting',
  'Internal Review',
  'Submitted',
  'Client Review',
  'Shortlisted',
  'Won',
  'Lost',
  'Withdrawn',
];

export const OPEN_STAGES = STAGES.filter((s) => !['Won', 'Lost', 'Withdrawn'].includes(s));

export const CLOSED_STAGES = ['Won', 'Lost', 'Withdrawn'];

export const LOSS_REASONS = [
  'Price',
  'Timing',
  'Incumbent / existing supplier',
  'Missing capability',
  'No decision / budget pulled',
  'Compliance / requirements',
  'Relationship',
  'Other',
];

export const STAGE_PROBABILITY = {
  Drafting: 0.1,
  'Internal Review': 0.2,
  Submitted: 0.4,
  'Client Review': 0.5,
  Shortlisted: 0.7,
  Won: 1,
  Lost: 0,
  Withdrawn: 0,
};

export const STAGE_BADGE = {
  Drafting: 'default',
  'Internal Review': 'ongoing',
  Submitted: 'active',
  'Client Review': 'Demo',
  Shortlisted: 'Negotiation',
  Won: 'success',
  Lost: 'danger',
  Withdrawn: 'cold',
};

export const ORIGIN_ICON = {
  'RFP / Requested': '📨',
  'Tender / EOI': '📑',
  'Unsolicited Pitch': '💡',
  Renewal: '🔄',
  Expansion: '📈',
};

export const SEVERITY_DOT = {
  Critical: 'bg-red-600',
  'At Risk': 'bg-orange-500',
  Watch: 'bg-amber-400',
};

export const SORT_OPTIONS = [
  { id: 'deadline', label: 'Deadline (soonest)' },
  { id: 'value', label: 'Value (highest)' },
  { id: 'stage', label: 'Stage' },
  { id: 'recent', label: 'Recently added' },
  { id: 'title', label: 'Title (A–Z)' },
];

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

export const formatMoney = (value) => {
  if (!value) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
};

export const deadlineLabel = (days) => {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days > 0) return `${days}d left`;
  return `${Math.abs(days)}d overdue`;
};

export const emptyProposalForm = {
  title: '',
  reference: '',
  origin: 'RFP / Requested',
  stage: 'Drafting',
  client: '',
  prospectName: '',
  sector: '',
  contactName: '',
  owner: '',
  contributors: '',
  value: '',
  issuedDate: '',
  submissionDeadline: '',
  decisionExpected: '',
  proposalDoc: '',
  caseStudies: [],
  linkedTender: '',
  tags: [],
  notes: '',
};
