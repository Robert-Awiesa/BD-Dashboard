const Holiday = require('../models/Holiday');
const Reminder = require('../models/Reminder');

const todayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const toDateKey = (d) => d.toISOString().slice(0, 10);

// Built-in Ghana Public Holidays fallback dataset for high reliability offline or on network failure
const getGhanaHolidaysFallback = (year) => [
  { name: "New Year's Day", localName: "New Year's Day", date: `${year}-01-01` },
  { name: "Constitution Day", localName: "Constitution Day", date: `${year}-01-07` },
  { name: "Independence Day", localName: "Independence Day", date: `${year}-03-06` },
  { name: "Good Friday", localName: "Good Friday", date: `${year}-04-03` },
  { name: "Easter Monday", localName: "Easter Monday", date: `${year}-04-06` },
  { name: "May Day (Workers' Day)", localName: "May Day", date: `${year}-05-01` },
  { name: "Eid al-Fitr", localName: "Eid al-Fitr", date: `${year}-05-27` },
  { name: "Eid al-Adha", localName: "Eid al-Adha", date: `${year}-08-03` },
  { name: "Founders' Day", localName: "Founders' Day", date: `${year}-08-04` },
  { name: "Kwame Nkrumah Memorial Day", localName: "Kwame Nkrumah Memorial Day", date: `${year}-09-21` },
  { name: "Farmers' Day", localName: "Farmers' Day", date: `${year}-12-04` },
  { name: "Christmas Day", localName: "Christmas Day", date: `${year}-12-25` },
  { name: "Boxing Day", localName: "Boxing Day", date: `${year}-12-26` },
];

/**
 * Sync Ghana Public Holidays from Nager.Date API or fallback dataset for a year
 */
exports.syncGhanaHolidays = async (year = new Date().getFullYear()) => {
  let holidays = [];
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/GH`);
    if (response.ok) {
      holidays = await response.json();
    } else {
      console.warn(`Nager.Date API returned ${response.status}. Using Ghana holiday fallback dataset.`);
      holidays = getGhanaHolidaysFallback(year);
    }
  } catch (err) {
    console.warn(`Fetch Ghana holidays API error (${err.message}). Using Ghana holiday fallback dataset.`);
    holidays = getGhanaHolidaysFallback(year);
  }

  const today = todayDateOnly();
  const synced = [];

  for (const h of holidays) {
    const holidayDate = new Date(h.date);
    holidayDate.setHours(0, 0, 0, 0);

    // Calculate 7-day advance notification trigger date
    const triggerDate = new Date(holidayDate);
    triggerDate.setDate(triggerDate.getDate() - 7);
    triggerDate.setHours(0, 0, 0, 0);

    let initialStatus = 'Upcoming';
    let reminderActive = false;
    let notificationTriggered = false;

    if (today > holidayDate) {
      initialStatus = 'Passed';
    } else if (today >= triggerDate) {
      initialStatus = 'Active Reminder';
      reminderActive = true;
      notificationTriggered = true;
    }

    const doc = await Holiday.findOneAndUpdate(
      { name: h.localName || h.name, date: holidayDate },
      {
        name: h.localName || h.name,
        englishName: h.name || h.localName,
        date: holidayDate,
        notificationTriggerDate: triggerDate,
        countryCode: 'GH',
        notificationTriggered,
        reminderActive,
        status: initialStatus,
      },
      { upsert: true, new: true }
    );
    synced.push(doc);
  }

  // Evaluate reminders after sync
  await exports.evaluateGhanaHolidayReminders();
  return synced;
};

/**
 * 7-Day Notification & Reminder Engine Worker for Ghana Holidays
 */
exports.evaluateGhanaHolidayReminders = async () => {
  const today = todayDateOnly();
  const todayKey = toDateKey(today);
  const results = [];

  try {
    // 1. Activate reminders 7 days in advance (today >= triggerDate AND today <= holidayDate)
    const upcomingHolidays = await Holiday.find({
      notificationTriggerDate: { $lte: today },
      date: { $gte: today },
    });

    for (const holiday of upcomingHolidays) {
      holiday.notificationTriggered = true;
      holiday.reminderActive = true;
      holiday.status = 'Active Reminder';
      await holiday.save();

      const holidayDateStr = holiday.date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const isToday = toDateKey(holiday.date) === todayKey;

      const reminderDoc = {
        sourceType: 'Ghana Public Holiday',
        sourceId: holiday._id,
        reminderDate: todayKey,
        reminderType: isToday ? 'today' : 'upcoming',
        message: `🇬🇭 Ghana Public Holiday: "${holiday.name}" on ${holidayDateStr}. Plan team schedules accordingly.`,
        responsiblePerson: 'All Team',
      };

      await Reminder.updateOne(
        { sourceType: 'Ghana Public Holiday', sourceId: holiday._id, reminderDate: todayKey },
        reminderDoc,
        { upsert: true }
      );

      results.push(reminderDoc);
    }

    // 2. Clear/archive reminders for passed holidays (date < today)
    const passedHolidays = await Holiday.find({
      date: { $lt: today },
      status: { $ne: 'Passed' },
    });

    for (const holiday of passedHolidays) {
      holiday.reminderActive = false;
      holiday.status = 'Passed';
      await holiday.save();
    }
  } catch (err) {
    console.error('Error evaluating Ghana holiday reminders:', err);
  }

  return results;
};

/**
 * Queries
 */
exports.getHolidays = async (filters = {}) => {
  const { year, status, search } = filters;
  const query = {};

  if (year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year), 11, 31, 23, 59, 59);
    query.date = { $gte: start, $lte: end };
  }

  if (status) query.status = status;

  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { englishName: rx }, { notes: rx }];
  }

  return Holiday.find(query).sort({ date: 1 });
};

exports.getHolidayStats = async () => {
  const today = todayDateOnly();
  const currentYear = today.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  const holidaysThisYear = await Holiday.find({ date: { $gte: startOfYear, $lte: endOfYear } }).sort({ date: 1 });

  const activeReminders = holidaysThisYear.filter((h) => h.status === 'Active Reminder');
  const upcoming = holidaysThisYear.filter((h) => h.status === 'Upcoming' || h.status === 'Active Reminder');
  const passed = holidaysThisYear.filter((h) => h.status === 'Passed');

  const nextHoliday = upcoming.find((h) => h.date >= today);
  let daysToNext = null;
  if (nextHoliday) {
    daysToNext = Math.ceil((new Date(nextHoliday.date) - today) / (1000 * 60 * 60 * 24));
  }

  return {
    totalThisYear: holidaysThisYear.length,
    activeRemindersCount: activeReminders.length,
    upcomingCount: upcoming.length,
    passedCount: passed.length,
    nextHoliday: nextHoliday || null,
    daysToNext,
    activeReminders,
  };
};

exports.updateHoliday = async (id, updates) => {
  const holiday = await Holiday.findById(id);
  if (!holiday) throw new Error('Holiday not found');
  if (updates.notes !== undefined) holiday.notes = updates.notes;
  await holiday.save();
  return holiday;
};
