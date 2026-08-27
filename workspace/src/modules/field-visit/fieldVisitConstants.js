// Field Visits vocabulary. Visits are Interaction records of type 'Site Visit',
// so these constants sit alongside the client-relations ones rather than
// duplicating them.

export const VISIT_STATUSES = ['Planned', 'Completed', 'Cancelled'];

export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

export const STATUS_BADGE = {
  Planned: 'Demo',
  Completed: 'success',
  Cancelled: 'cold',
};

export const SENTIMENT_ICON = {
  Positive: '🙂',
  Neutral: '😐',
  Negative: '🙁',
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

// Calendar days apart, not elapsed milliseconds. Diffing raw timestamps makes
// a visit booked for tomorrow read as "today" once the clock passes midday,
// because 10 hours rounds to 0 — the comparison has to be date-to-date.
const calendarDaysFromToday = (value) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(value);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
};

export const relativeDays = (value) => {
  if (!value) return '—';
  const days = calendarDaysFromToday(value);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
};

export const formatDuration = (minutes) => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const VISIT_TYPES = ['Standard', 'Discovery'];

export const TYPE_BADGE = {
  Standard: 'info',
  Discovery: 'purple',
};

export const DEFAULT_PAIN_POINTS = [
  { title: 'Missed Follow Ups', description: 'Lack of automated reminders leading to forgotten maintenance checks' },
  { title: 'Poor Communication', description: 'Manual updates cause phone tag and client frustration' },
  { title: 'Scheduling Mess', description: 'Conflicts in appointment booking and service queueing' },
  { title: 'Customer Complaints / Frustrations', description: 'Clients having to repeatedly call or wait on-site for status updates' },
  { title: 'Wasted Staff Time', description: 'Manual paper-based registration and vehicle tracking overhead' },
];

export const DEFAULT_PROPOSITIONS = [
  { title: 'Centralised CRM & Queuing System', description: 'Unified platform to register vehicles, assign queue numbers, and manage client records' },
  { title: 'Automated SMS Alerts / Remote Updates', description: 'Step-by-step text notifications and interactive approval links for repair estimates' },
  { title: 'On-Premises Waiting Lounge Display', description: 'Visual TV screen interface displaying vehicle plate numbers, current status, and pickup alerts' },
  { title: 'Staff Check-In & Service Stage Portal', description: 'Digital check-in portal for front-desk agents and mechanics to update service stages (Diagnosing, In-Progress, Quality Check, Ready)' },
  { title: 'Digital Change Requests & Approvals', description: 'Instant sharing of unexpected maintenance needs and cost updates for client digital sign-off' },
];

// A visit is either being booked or being written up. Those are different jobs
// with different required fields, so the form declares which one it is.
export const emptyVisitForm = {
  client: '',
  visitStatus: 'Completed',
  visitType: 'Standard',
  locationName: '',
  address: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  purpose: '',
  summary: '',
  observations: '',
  contactName: '',
  teamAttendees: '',
  clientAttendees: '',
  sentiment: 'Neutral',
  durationMinutes: '',
  followUpNeeded: false,
  commitmentDescription: '',
  commitmentDue: '',
};

export const emptyDiscoveryForm = {
  client: '',
  visitStatus: 'Completed',
  visitType: 'Discovery',
  occurredAt: new Date().toISOString().slice(0, 10),
  locationName: '',
  address: '',
  teamAttendees: '',
  clientAttendees: '',
  contactEmail: '',
  operation: '',
  personnel: '',
  clientRequest: '',
  summary: '',
  painPoints: [{ title: '', description: '' }],
  propositions: [{ title: '', description: '' }],
  usersCount: '',
  processFlow: '',
  additionalNotes: '',
  sentiment: 'Neutral',
  durationMinutes: '',
  commitmentDescription: '',
  commitmentDue: '',
};
