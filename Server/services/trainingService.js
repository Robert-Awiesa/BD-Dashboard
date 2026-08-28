/**
 * Trainings, certifications and the awareness roadmap.
 *
 * Three collections rather than one, because they answer different questions:
 * what we are running now (Training), what credentials the team holds
 * (Certification), and what we intend to run this year (TrainingSchedule).
 *
 * The logic lives here rather than in the routes, so the roadmap sync has one
 * home instead of being repeated at every entry point, and so the
 * archive-before-delete rule the rest of the workspace uses applies here too.
 */
const Training = require('../models/Training');
const Certification = require('../models/Certification');
const TrainingSchedule = require('../models/TrainingSchedule');

const clean = (value) => (value === null || value === undefined ? '' : String(value).trim());

const escapeRx = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Only rows still in play, unless somebody explicitly asks for the rest.
const liveOnly = (query, includeArchived) => {
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };
  return query;
};

/**
 * Which roadmap bucket a session belongs in. Derived from what was typed
 * rather than asked for again — the vendor is almost always in the title.
 */
const inferCategory = (title = '', organizers = '', type = 'Internal') => {
  const text = `${title} ${organizers}`.toLowerCase();
  if (text.includes('aws')) return 'AWS';
  if (text.includes('sap')) return 'SAP';
  if (text.includes('esri') || text.includes('gis') || text.includes('arcgis')) return 'Esri';
  if (text.includes('opentext')) return 'OpenText';
  if (text.includes('tender') || text.includes('bid') || text.includes('proposal')) return 'BD / Tender';
  if (type === 'Internal') return 'General Tech';
  return 'Other';
};

// --------------------------------------------------------------------------
// Trainings
// --------------------------------------------------------------------------

exports.getTrainings = async (filters = {}) => {
  const query = liveOnly({}, filters.includeArchived);
  if (filters.progress) query.progress = filters.progress;
  if (filters.search && filters.search.trim()) {
    const rx = new RegExp(escapeRx(filters.search.trim()), 'i');
    query.$or = [{ title: rx }, { facilitator: rx }, { description: rx }, { takeaways: rx }];
  }
  return Training.find(query).sort({ createdAt: -1 });
};

// The calendar row that mirrors a training. Kept in step here so the roadmap
// does not have to be maintained by hand alongside the record it describes.
const syncScheduleFor = async (training) => {
  if (!training.dateRange?.start) return;
  const fields = {
    title: training.title,
    category: inferCategory(training.title, training.externalDetails?.organizers, training.type),
    targetDate: training.dateRange.start,
    targetGroup: training.participants?.length
      ? training.participants.join(', ')
      : (training.type === 'Internal' ? 'Internal Team' : 'All Staff'),
    note: training.description || training.takeaways || '',
    status: 'Logged as Training',
    convertedTrainingId: training._id,
  };

  const existing = await TrainingSchedule.findOne({ convertedTrainingId: training._id });
  if (existing) {
    Object.assign(existing, fields);
    await existing.save();
    return;
  }
  await TrainingSchedule.create(fields);
};

exports.createTraining = async (data) => {
  if (!clean(data.title)) throw new Error('A training needs a title');
  const training = await Training.create(data);
  await syncScheduleFor(training);
  return training;
};

exports.updateTraining = async (id, data) => {
  const training = await Training.findById(id);
  if (!training) throw new Error('Training not found');
  const { _id, archived, archivedAt, ...rest } = data;
  Object.assign(training, rest);
  await training.save();
  await syncScheduleFor(training);
  return training;
};

exports.setTrainingArchived = async (id, archived) => {
  const training = await Training.findById(id);
  if (!training) throw new Error('Training not found');
  training.archived = Boolean(archived);
  training.archivedAt = training.archived ? new Date() : undefined;
  await training.save();
  // The calendar row is a mirror, so it follows the record it mirrors rather
  // than being left behind pointing at something nobody can see.
  await TrainingSchedule.updateMany(
    { convertedTrainingId: training._id },
    { $set: { archived: training.archived, archivedAt: training.archivedAt } }
  );
  return training;
};

exports.deleteTraining = async (id) => {
  const training = await Training.findById(id);
  if (!training) throw new Error('Training not found');
  if (!training.archived) {
    throw new Error('Archive this training before deleting — the attendees and takeaways go with it.');
  }
  await TrainingSchedule.deleteMany({ convertedTrainingId: training._id });
  await training.deleteOne();
  return training;
};

// --------------------------------------------------------------------------
// Certifications
// --------------------------------------------------------------------------

exports.getCertifications = async (filters = {}) => {
  const query = liveOnly({}, filters.includeArchived);
  if (filters.ecosystem && filters.ecosystem !== 'All') query.ecosystem = filters.ecosystem;
  if (filters.search && filters.search.trim()) {
    const rx = new RegExp(escapeRx(filters.search.trim()), 'i');
    query.$or = [{ title: rx }, { candidate: rx }, { ecosystem: rx }, { customEcosystem: rx }];
  }
  return Certification.find(query).sort({ createdAt: -1 });
};

exports.createCertification = async (data) => {
  if (!clean(data.title)) throw new Error('A certification needs a title');
  if (!clean(data.candidate)) throw new Error('Say who is taking it — a certification belongs to a person');
  return Certification.create(data);
};

exports.updateCertification = async (id, data) => {
  const cert = await Certification.findById(id);
  if (!cert) throw new Error('Certification not found');
  const { _id, archived, archivedAt, ...rest } = data;
  Object.assign(cert, rest);
  await cert.save();
  return cert;
};

exports.setCertificationArchived = async (id, archived) => {
  const cert = await Certification.findById(id);
  if (!cert) throw new Error('Certification not found');
  cert.archived = Boolean(archived);
  cert.archivedAt = cert.archived ? new Date() : undefined;
  await cert.save();
  return cert;
};

exports.deleteCertification = async (id) => {
  const cert = await Certification.findById(id);
  if (!cert) throw new Error('Certification not found');
  if (!cert.archived) {
    throw new Error('Archive this certification before deleting — it is the record that the credential was held.');
  }
  await cert.deleteOne();
  return cert;
};

// --------------------------------------------------------------------------
// Awareness roadmap
// --------------------------------------------------------------------------

exports.getSchedules = async (filters = {}) => {
  const query = liveOnly({}, filters.includeArchived);
  if (filters.year) query.targetYear = Number(filters.year);
  if (filters.month) query.targetMonth = Number(filters.month);
  if (filters.category && filters.category !== 'All') query.category = filters.category;
  if (filters.search && filters.search.trim()) {
    const rx = new RegExp(escapeRx(filters.search.trim()), 'i');
    query.$or = [{ title: rx }, { targetGroup: rx }, { note: rx }, { category: rx }];
  }
  return TrainingSchedule.find(query).sort({ targetDate: 1 }).populate('convertedTrainingId');
};

exports.getScheduleStats = async (year) => {
  const targetYear = Number(year) || new Date().getFullYear();
  const schedules = await TrainingSchedule.find({ targetYear, archived: { $ne: true } });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;

  return {
    year: targetYear,
    totalScheduled: schedules.length,
    dueThisMonth: schedules.filter((s) => s.targetMonth === currentMonth).length,
    upcomingCount: schedules.filter((s) => s.targetDate && new Date(s.targetDate) >= today).length,
  };
};

exports.createSchedule = async (data) => {
  if (!clean(data.title)) throw new Error('A roadmap item needs a title');
  if (!data.targetDate) throw new Error('A roadmap item needs a target date');
  return TrainingSchedule.create(data);
};

exports.updateSchedule = async (id, data) => {
  const schedule = await TrainingSchedule.findById(id);
  if (!schedule) throw new Error('Training awareness item not found');
  const { _id, archived, archivedAt, ...rest } = data;
  Object.assign(schedule, rest);
  await schedule.save();
  return schedule;
};

exports.setScheduleArchived = async (id, archived) => {
  const schedule = await TrainingSchedule.findById(id);
  if (!schedule) throw new Error('Training awareness item not found');
  schedule.archived = Boolean(archived);
  schedule.archivedAt = schedule.archived ? new Date() : undefined;
  await schedule.save();
  return schedule;
};

exports.deleteSchedule = async (id) => {
  const schedule = await TrainingSchedule.findById(id);
  if (!schedule) throw new Error('Training awareness item not found');
  if (!schedule.archived) {
    throw new Error('Archive this roadmap item before deleting — somebody planned it for a reason.');
  }
  await schedule.deleteOne();
  return schedule;
};

/** Turn a planned roadmap item into the record of a session that happened. */
exports.convertScheduleToTraining = async (id, body = {}) => {
  const schedule = await TrainingSchedule.findById(id);
  if (!schedule) throw new Error('Schedule item not found');

  const training = await Training.create({
    title: body.title || schedule.title,
    type: body.type || 'Internal',
    dateRange: {
      start: body.dateRange?.start || schedule.targetDate,
      end: body.dateRange?.end || schedule.targetDate,
    },
    participants: body.participants || [],
    facilitator: body.facilitator || '',
    description: body.description || schedule.note || '',
    takeaways: body.takeaways || '',
    progress: body.progress || 'Completed',
    externalDetails: {
      organizers: body.externalDetails?.organizers || schedule.category || '',
      country: body.externalDetails?.country || 'Online',
      modality: body.externalDetails?.modality || 'Online',
      cost: body.externalDetails?.cost || 'Free',
    },
  });

  schedule.status = 'Logged as Training';
  schedule.convertedTrainingId = training._id;
  await schedule.save();

  return { message: 'Logged as formal training session', training, schedule };
};

exports.inferCategory = inferCategory;
