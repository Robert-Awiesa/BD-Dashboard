export const PLATFORMS = [
  { key: 'TikTok', label: 'TikTok', icon: '🎵', url: 'https://www.tiktok.com/@tgtsafrica' },
  { key: 'Instagram', label: 'Instagram', icon: '📷', url: 'https://www.instagram.com/tgts_africa?igsh=ZTk2YTI1amwzY2Vs&igsi=ZTk2YTI1amwzY2Vs' },
  { key: 'LinkedIn', label: 'LinkedIn', icon: '💼', url: 'https://www.linkedin.com/company/tenth-generation-technology-systems-tgts/?lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3Bcp9HTZPfTHqV2caNcpMD2g%3D%3D' },
  { key: 'Facebook', label: 'Facebook', icon: '👍', url: 'https://www.facebook.com/share/v/198umEKUj6/' },
  { key: 'YouTube', label: 'YouTube', icon: '▶️', url: 'https://youtube.com/@tgtsafricaa?si=IQuVnqzYCi6GegbU' },
];

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export const POST_TYPES = ['Reel', 'Carousel', 'Static', 'Story', 'Video', 'Text Post'];

export const SHOT_TYPES = ['Talking Head', 'B-Roll', 'Screen Recording', 'Interview', 'Voiceover'];

export const CONTENT_STATUSES = ['Scheduled', 'Scripted', 'Published', 'Archived'];

export const emptyScheduleForm = {
  platform: PLATFORMS[0].key,
  title: '',
  scheduleDate: '',
  time: '',
  postType: POST_TYPES[0],
  responsiblePerson: '',
  message: '',
};

export const emptyScriptForm = {
  platform: PLATFORMS[0].key,
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
