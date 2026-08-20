// Shared vocabulary for Client Relations.
// Mirrors the enums in Server/models/Client.js and Interaction.js; live values
// are also served from /api/clients/meta.

export const TIERS = ['Strategic', 'Key', 'Standard'];

// Kept in sync with DEFAULT_CADENCE_DAYS on the server — shown in the form so
// the account owner can see what rhythm they are signing up to.
export const DEFAULT_CADENCE_DAYS = { Strategic: 14, Key: 30, Standard: 90 };

export const CLIENT_STATUSES = ['Onboarding', 'Active', 'Dormant', 'Churned'];

export const INTERACTION_TYPES = ['Call', 'Meeting', 'Site Visit', 'Email', 'Event', 'Support', 'Note'];

export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

export const HEALTH_STATUSES = ['Healthy', 'Watch', 'At Risk', 'Critical', 'Dormant', 'Churned'];

// Maps onto the shared Badge component's status keys.
export const HEALTH_BADGE = {
  Healthy: 'success',
  Watch: 'ongoing',
  'At Risk': 'danger',
  Critical: 'danger',
  Dormant: 'cold',
  Churned: 'cold',
  Archived: 'cold',
};

export const TIER_BADGE = {
  Strategic: 'active',
  Key: 'Demo',
  Standard: 'default',
};

export const SENTIMENT_ICON = {
  Positive: '🙂',
  Neutral: '😐',
  Negative: '🙁',
};

export const INTERACTION_ICON = {
  Call: '📞',
  Meeting: '🤝',
  'Site Visit': '📍',
  Email: '✉️',
  Event: '🎤',
  Support: '🛠️',
  Note: '📝',
};

// Colour the dot in the needs-attention queue by how urgent the reason is.
export const SEVERITY_DOT = {
  Critical: 'bg-red-600',
  'At Risk': 'bg-orange-500',
  Watch: 'bg-amber-400',
};

export const SORT_OPTIONS = [
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'contact', label: 'Longest without contact' },
  { id: 'renewal', label: 'Renewal date' },
  { id: 'value', label: 'Contract value' },
  { id: 'recent', label: 'Recently added' },
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

// "3 days ago" reads faster than a date when scanning an activity feed.
// Compared date-to-date rather than by elapsed milliseconds: something logged
// at 9am should still read "today" at 11pm, not tip over into "yesterday".
export const relativeDays = (value) => {
  if (!value) return 'never';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(value);
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
};

export const formatMoney = (value) => {
  if (!value) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
};

export const emptyClientForm = {
  name: '',
  sector: '',
  tier: 'Standard',
  status: 'Active',
  accountOwner: '',
  contactCadenceDays: '',
  relationshipStart: '',
  contractValue: '',
  renewalDate: '',
  notes: '',
  tags: [],
  contacts: [],
};
