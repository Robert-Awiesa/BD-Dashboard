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

// A visit is either being booked or being written up. Those are different jobs
// with different required fields, so the form declares which one it is.
export const emptyVisitForm = {
  client: '',
  visitStatus: 'Completed',
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
