export const INDUSTRY_OPTIONS = [
  'Oil and Gas',
  'Manufacturing',
  'Mining',
  'Logistics',
  'Financial',
  'Others',
];

export const CALL_OUTCOMES = [
  'Connected - Interested',
  'Connected - Not Interested',
  'Voicemail Left',
  'Gatekeeper / Decision Maker Unavailable',
  'Wrong Number / Invalid Contact',
];

// Short label used for card badges — keeps the badge compact vs. the full outcome text.
export const CALL_OUTCOME_SHORT_LABEL = {
  'Connected - Interested': 'Connected',
  'Connected - Not Interested': 'Connected',
  'Voicemail Left': 'Voicemail',
  'Gatekeeper / Decision Maker Unavailable': 'Gatekeeper Blocked',
  'Wrong Number / Invalid Contact': 'Invalid Contact',
};

export const emptyColdCallForm = {
  prospectName: '',
  phoneNumber: '',
  industry: INDUSTRY_OPTIONS[0],
  customIndustry: '',
  callOutcome: CALL_OUTCOMES[0],
  notes: '',
  followUpAt: '',
  assignedAgent: '',
};
