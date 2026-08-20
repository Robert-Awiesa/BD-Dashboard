// Tasks & Projects vocabulary.
// Mirrors the enums in Server/models/Task.js and Project.js.

export const TASK_STATUSES = ['To Do', 'In Progress', 'Blocked', 'Done'];

export const PRIORITIES = ['High', 'Medium', 'Low'];

export const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'];

export const STATUS_BADGE = {
  'To Do': 'default',
  'In Progress': 'active',
  Blocked: 'danger',
  Done: 'success',
};

export const PRIORITY_BADGE = {
  High: 'danger',
  Medium: 'ongoing',
  Low: 'cold',
};

export const PROJECT_STATUS_BADGE = {
  Active: 'active',
  'On Hold': 'ongoing',
  Completed: 'success',
  Cancelled: 'cold',
};

// Where a piece of work came from. Only 'Task' is owned here — the rest are
// read-through mirrors, which is why they get a source chip rather than an
// edit button.
export const SOURCE_CHIP = {
  Task: { icon: '✅', className: 'bg-slate-100 text-slate-600' },
  Proposal: { icon: '📝', className: 'bg-forest-50 text-forest-700' },
  Client: { icon: '🤝', className: 'bg-amber-50 text-amber-700' },
  Event: { icon: '🗓️', className: 'bg-sky-50 text-sky-700' },
  'DG Event': { icon: '🏛️', className: 'bg-violet-50 text-violet-700' },
};

// Work is grouped by urgency rather than status: the question someone opens
// this page with is "what do I need to do", not "what state is everything in".
export const BUCKETS = [
  { id: 'overdue', label: 'Overdue', tone: 'danger' },
  { id: 'today', label: 'Today', tone: 'warn' },
  { id: 'thisWeek', label: 'This week', tone: 'default' },
  { id: 'later', label: 'Later', tone: 'default' },
  { id: 'noDate', label: 'No date', tone: 'muted' },
];

export const bucketFor = (item) => {
  if (item.daysToDue === null || item.daysToDue === undefined) return 'noDate';
  if (item.daysToDue < 0) return 'overdue';
  if (item.daysToDue === 0) return 'today';
  if (item.daysToDue <= 7) return 'thisWeek';
  return 'later';
};

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const dueLabel = (days) => {
  if (days === null || days === undefined) return 'no date';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days}d`;
  return `${Math.abs(days)}d overdue`;
};

export const emptyTaskForm = {
  title: '',
  description: '',
  owner: '',
  dueDate: '',
  status: 'To Do',
  priority: 'Medium',
  project: '',
  blockedReason: '',
};

export const emptyProjectForm = {
  name: '',
  description: '',
  owner: '',
  targetDate: '',
  status: 'Active',
};
