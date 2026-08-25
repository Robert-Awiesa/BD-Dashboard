export const LOCATION_TYPES = ['Online', 'Physical', 'Hybrid'];

export const AD_FORMATS = [
  'Video', 'Single image', 'Multiple images', 'Text',
  'Spotlight', 'Message', 'Conversation', 'Event', 'Document',
];

export const PLACEMENT_SITES = ['News Paper', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'];

export const BUDGET_TYPES = ['Daily budget', 'Life time', 'Both'];

export const COMPANY_SIZES = ['1-20', '20-40', '40-60', '60-80', '80-100', '100+'];

// The brackets the ad platforms actually report on, so a typed "25-34 yrs" and
// "25 - 34" stop being two different audiences at reporting time.
export const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'All ages'];

export const DEGREES = ['BSc', 'Masters', 'PhD'];

export const DEVICE_OPTIONS = ['Phone', 'Laptop', 'Tablet', 'Desktop'];

export const CAMPAIGN_STATUSES = ['Planning', 'Active', 'Completed', 'Reschedule Needed'];

export const emptyCampaignForm = {
  campaignName: '',
  targetAudience: [],
  excludedAudience: [],
  locationType: 'Online',
  physicalLocation: '',
  targetIndustries: [],
  targetCompanies: [],
  companySize: COMPANY_SIZES[0],
  companyAnnualRevenue: '',
  audienceDegrees: [],
  audienceAgeRange: '',
  audienceDevices: [],
  adFormats: [],
  platforms: [],
  budgetType: BUDGET_TYPES[0],
  budgetAmount: '',
  startDate: '',
  endDate: '',
  responsiblePerson: '',
};

// Metric field definitions per platform — mirrors the weekly performance report
// templates (Executive Summary + per-platform analytics cards). Each field maps
// straight onto campaign.platformMetrics[].metrics for that platform.
export const PLATFORM_METRIC_FIELDS = {
  LinkedIn: [
    { key: 'impressions', label: 'Impressions', type: 'number' },
    { key: 'impressionsGrowth', label: 'Impressions Growth (%)', type: 'text', placeholder: 'e.g. -30.9%' },
    { key: 'reactions', label: 'Reactions', type: 'number' },
    { key: 'reactionsGrowth', label: 'Reactions Growth (%)', type: 'text', placeholder: 'e.g. -22.4%' },
    { key: 'totalPosts', label: 'Total Posts', type: 'number' },
    { key: 'pageViews', label: 'Page Views', type: 'number' },
    { key: 'pageViewsGrowth', label: 'Page Views Growth (%)', type: 'text', placeholder: 'e.g. -16.7%' },
    { key: 'newFollowers', label: 'New Followers', type: 'number' },
    { key: 'pageSearches', label: 'Page Searches', type: 'number' },
  ],
  TikTok: [
    { key: 'audienceReached', label: 'Audience Reached', type: 'number' },
    { key: 'totalViews', label: 'Total Views', type: 'number' },
    { key: 'engagedAudience', label: 'Engaged Audience', type: 'number' },
    { key: 'totalPosts', label: 'Total Posts', type: 'number' },
    { key: 'newFollowers', label: 'New Followers', type: 'number' },
    { key: 'profileViews', label: 'Profile Views', type: 'number' },
    { key: 'genderSplitFemale', label: 'Gender Split — Female (%)', type: 'number' },
    { key: 'genderSplitMale', label: 'Gender Split — Male (%)', type: 'number' },
    { key: 'topAgeGroup', label: 'Top Age Group', type: 'text', placeholder: 'e.g. 25-34 years (40%)' },
    { key: 'topLocation', label: 'Top Location', type: 'text', placeholder: 'e.g. Ghana (63.1%)' },
  ],
  Instagram: [
    { key: 'accountsReached', label: 'Accounts Reached', type: 'number' },
    { key: 'totalViews', label: 'Total Views', type: 'number' },
    { key: 'profileVisits', label: 'Profile Visits', type: 'number' },
    { key: 'totalInteractions', label: 'Total Interactions', type: 'number' },
    { key: 'newFollowers', label: 'New Followers', type: 'number' },
    { key: 'accountsEngaged', label: 'Accounts Engaged', type: 'number' },
    { key: 'genderSplitMen', label: 'Gender Distribution — Men (%)', type: 'number' },
    { key: 'genderSplitWomen', label: 'Gender Distribution — Women (%)', type: 'number' },
  ],
  Facebook: [
    { key: 'reach', label: 'Reach', type: 'number' },
    { key: 'impressions', label: 'Impressions', type: 'number' },
    { key: 'pageLikes', label: 'Page Likes / New Followers', type: 'number' },
    { key: 'engagement', label: 'Engagement', type: 'number' },
    { key: 'totalPosts', label: 'Total Posts', type: 'number' },
  ],
  'News Paper': [
    { key: 'circulation', label: 'Circulation / Readership', type: 'number' },
    { key: 'adSpend', label: 'Ad Spend', type: 'number' },
    { key: 'inquiries', label: 'Inquiries Generated', type: 'number' },
  ],
};

export const emptyMetricsFor = (platform) => {
  const fields = PLATFORM_METRIC_FIELDS[platform] || [];
  return fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
};
