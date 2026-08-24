export const EVENT_TYPES = [
  'External Conference',
  'Internal DG Briefing',
  'Internal Briefing',
  'Webinar',
  'Podcast',
  'Strategic Alignment',
  'General Event',
];

// Types that unlock the media-production stage of the wizard.
export const MEDIA_EVENT_TYPES = ['Webinar', 'Podcast'];

// Quick-filter pills. "Webinars & Podcasts" deliberately spans two types so the
// media programme reads as one stream to the team.
export const EVENT_FILTERS = [
  { key: 'all', label: 'All', types: null },
  { key: 'external', label: 'External Conferences', types: ['External Conference'] },
  { key: 'dg', label: 'Internal DG Briefings', types: ['Internal DG Briefing'] },
  { key: 'briefing', label: 'Internal Briefings', types: ['Internal Briefing'] },
  { key: 'media', label: 'Webinars & Podcasts', types: ['Webinar', 'Podcast'] },
  { key: 'strategic', label: 'Strategic Alignment', types: ['Strategic Alignment', 'General Event'] },
];

export const MODALITIES = ['Virtual', 'Physical', 'Hybrid'];
export const MODALITY_ICON = { Virtual: '💻', Physical: '📍', Hybrid: '🔀' };

export const ATTENDEE_ROLES = ['Attendee', 'Speaker', 'Organizer', 'Booth Lead'];
export const RSVP_STATUSES = ['Confirmed', 'Pending', 'Declined'];

export const MILESTONE_TYPES = [
  'Team Member',
  'Partner Milestone',
  'VIP Stakeholder Birthday',
];

// Mirrors TYPE_RULES in Server/models/Milestone.js, which enforces them.
// `anchor: 'start'` means the recurring date is read off the start date rather
// than typed in — a partnership anniversary IS the day it began.
export const MILESTONE_RULES = {
  'Team Member': {
    anchor: 'birth',
    startDate: 'required',
    startLabel: 'Work start date',
    startHint: 'The day they joined. Their work anniversary is counted from this.',
  },
  'Partner Milestone': {
    anchor: 'start',
    startDate: 'required',
    startLabel: 'Partnership start date',
    startHint: 'The anniversary falls on this date each year.',
  },
  'VIP Stakeholder Birthday': {
    anchor: 'birth',
    startDate: 'none',
    startLabel: '',
    startHint: '',
  },
};

export const MILESTONE_ICON = {
  'Team Member': '🎂',
  'Partner Milestone': '🤝',
  'VIP Stakeholder Birthday': '⭐',
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const DG_DEPARTMENTS = ['Operations', 'Marketing', 'Tech', 'Logistics', 'Finance', 'Executive'];
export const DG_PROPOSAL_TYPES = ['Session Proposal', 'Budget Request', 'Resource Requirement', 'General Idea'];
export const DG_PROPOSAL_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Declined'];

export const emptyEventForm = {
  title: '',
  eventType: 'External Conference',
  description: '',
  startDate: '',
  endDate: '',
  modality: 'Virtual',
  streamingLink: '',
  locationDetails: '',
  assignedLead: '',
  episodeNumber: '',
  hostModerator: '',
  speakers: [],
  linkedScript: '',
  linkedCampaign: '',
  prepChecklist: [],
  attendees: [],
};

export const emptyMilestoneForm = {
  milestoneType: 'Team Member',
  participantName: '',
  departmentOrCompany: '',
  role: '',
  milestoneMonth: 1,
  milestoneDay: 1,
  originalStartDate: '',
  isDraft: false,
  favouriteQuote: '',
  notes: '',
};

export const EVENT_METRIC_FIELDS = [
  { key: 'registrants', label: 'Total Registrants / RSVPs', type: 'number' },
  { key: 'peakLiveAttendees', label: 'Peak Live Attendees', type: 'number' },
  { key: 'playbackViews', label: 'Playback Views (7-day)', type: 'number' },
  { key: 'averageWatchTime', label: 'Average Watch Time', type: 'text', placeholder: 'e.g. 24m 30s' },
  { key: 'dropOffRate', label: 'Drop-off Rate', type: 'text', placeholder: 'e.g. 38%' },
  { key: 'qaInteractions', label: 'Q&A Questions Asked', type: 'number' },
  { key: 'pollResponses', label: 'Poll Responses', type: 'number' },
  { key: 'leadsGenerated', label: 'New Prospect Leads', type: 'number' },
  { key: 'partnerMentions', label: 'Partner Mentions / Collabs', type: 'text' },
];

export const statusBadgeTone = (status) => {
  if (status === 'Completed') return 'success';
  if (status === 'Cancelled') return 'danger';
  if (status === 'Ongoing') return 'ongoing';
  return 'active';
};

export const formatDateRange = (start, end) => {
  if (!start) return '—';
  const opts = { dateStyle: 'medium' };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (!end) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return s === e ? s : `${s} → ${e}`;
};
