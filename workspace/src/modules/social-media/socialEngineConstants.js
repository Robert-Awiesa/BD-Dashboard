export const PLATFORMS = [
  { key: 'TikTok', label: 'TikTok', icon: '🎵', url: 'https://www.tiktok.com/@tgtsafrica' },
  { key: 'Instagram', label: 'Instagram', icon: '📷', url: 'https://www.instagram.com/tgts_africa?igsh=ZTk2YTI1amwzY2Vs&igsi=ZTk2YTI1amwzY2Vs' },
  { key: 'LinkedIn', label: 'LinkedIn', icon: '💼', url: 'https://www.linkedin.com/company/tenth-generation-technology-systems-tgts/?lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3Bcp9HTZPfTHqV2caNcpMD2g%3D%3D' },
  { key: 'Facebook', label: 'Facebook', icon: '👍', url: 'https://www.facebook.com/share/v/198umEKUj6/' },
  { key: 'YouTube', label: 'YouTube', icon: '▶️', url: 'https://youtube.com/@tgtsafricaa?si=IQuVnqzYCi6GegbU' },
];

// Somewhere we do not run a proper account. Kept out of PLATFORMS so the
// platform cards and their links stay the five we actually maintain, but
// selectable in every form that picks a platform.
export const OTHER_PLATFORM = 'Other';

export const PLATFORM_CHOICES = [...PLATFORMS.map((p) => p.key), OTHER_PLATFORM];

// What to show for a post: the typed name when it was filed under Other.
export const platformLabel = (entry) =>
  (entry?.platform === OTHER_PLATFORM ? entry.platformOther : entry?.platform) || entry?.platform || '';

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export const POST_TYPES = ['Reel', 'Carousel', 'Static', 'Story', 'Video', 'Text Post'];

export const SHOT_TYPES = ['B-Roll', 'Interview', 'Voiceover'];

export const CONTENT_STATUSES = ['Scheduled', 'Scripted', 'Published', 'Archived'];

export const emptyScheduleForm = {
  platform: PLATFORMS[0].key,
  platformOther: '',
  title: '',
  scheduleDate: '',
  time: '',
  postType: POST_TYPES[0],
  responsiblePerson: '',
  message: '',
};

export const emptyScriptForm = {
  platform: PLATFORMS[0].key,
  platformOther: '',
  title: '',
  product: '',
  model: '',
  responsiblePerson: '',
  scheduleDate: '',
  shotType: SHOT_TYPES[0],
  scriptFileUrl: '',
  scriptFileName: '',
};

export const emptyContentForm = {
  platform: PLATFORMS[0].key,
  platformOther: '',
  title: '',
  postType: POST_TYPES[0],
  postLink: '',
  interestingSnippet: '',
  coverImage: '',
  status: 'Published',
};

export const dayOfWeekFromDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
};
