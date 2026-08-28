import { useEffect, useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import CelebrationIcon from './celebrationIcons';
import EventCard from './EventCard';
import EventWizardModal from './EventWizardModal';
import EventMetricsModal from './EventMetricsModal';
import MilestoneModal from './MilestoneModal';
import DgEventWorkspace from './DgEventWorkspace';
import GhanaHolidaysWorkspace from './GhanaHolidaysWorkspace';
import AddMediaModal from './AddMediaModal';
import RescheduleReminderModal from '../../components/common/RescheduleReminderModal';
import CompleteReminderModal from '../../components/common/CompleteReminderModal';
import { EVENT_FILTERS, MONTHS } from './eventConstants';

const TABS = [
  { key: 'hub', label: 'Operational Hub' },
  { key: 'dg', label: 'DG Annual Event' },
  { key: 'holidays', label: 'Ghana Holidays 🇬🇭' },
];

const EventsModule = () => {
  const [activeTab, setActiveTab] = useState('hub');
  const [events, setEvents] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [sweeping, setSweeping] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [metricsEvent, setMetricsEvent] = useState(null);

  const [showMilestone, setShowMilestone] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [viewingMilestone, setViewingMilestone] = useState(null);

  const [media, setMedia] = useState([]);
  const [showMedia, setShowMedia] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getEvents(),
      // scope=team keeps client appreciation dates off the team culture board.
      bdApi.getMilestones({ scope: 'team' }),
      bdApi.getReminders(),
      bdApi.getSocialContent(),
      bdApi.getCampaigns(),
      bdApi.getMediaArchive(),
    ])
      .then(([ev, ms, rm, sc, cp, md]) => {
        if (ignore) return;
        setEvents(ev);
        setMilestones(ms);
        // Events + milestones only — campaign reminders live on their own tab.
        setReminders(rm.filter((r) => r.sourceType !== 'Campaign'));
        setScripts(sc.filter((s) => s.scriptFileUrl || s.shotType || s.product));
        setCampaigns(cp);
        setMedia(md);
      })
      .catch((err) => {
        console.error('Failed to load events:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const visibleEvents = useMemo(() => {
    const active = EVENT_FILTERS.find((f) => f.key === filter);
    if (!active?.types) return events;
    return events.filter((e) => active.types.includes(e.eventType));
  }, [events, filter]);

  const upsertEvent = (event) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e._id === event._id);
      if (idx === -1) return [event, ...prev];
      const next = [...prev];
      next[idx] = event;
      return next;
    });
    setMetricsEvent((prev) => (prev && prev._id === event._id ? event : prev));
  };

  const handleEventSubmit = async (form) => {
    setSubmitting(true);
    try {
      const saved = editingEvent
        ? await bdApi.updateEvent(editingEvent._id, form)
        : await bdApi.addEvent(form);
      // The list endpoint populates linked script/campaign; refetch so the
      // card shows those chips immediately rather than raw ids.
      const fresh = await bdApi.getEvents();
      setEvents(fresh);
      setEditingEvent(null);
      return saved;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this event? Its prep tasks, RSVPs and reminders go too.')) return;
    try {
      await bdApi.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e._id !== id));
      setReminders((prev) => prev.filter((r) => r.sourceId !== id));
    } catch (err) {
      alert(`Error deleting event: ${err.message}`);
    }
  };

  const handleToggleTask = async (eventId, taskId, completed) => {
    try {
      upsertEvent(await bdApi.toggleEventTask(eventId, taskId, completed));
    } catch (err) {
      alert(`Error updating task: ${err.message}`);
    }
  };

  const handleUpdateAttendee = async (eventId, attendeeId, updates) => {
    try {
      upsertEvent(await bdApi.updateEventAttendee(eventId, attendeeId, updates));
    } catch (err) {
      alert(`Error updating RSVP: ${err.message}`);
    }
  };

  const handleMilestoneSubmit = async (form) => {
    setSubmitting(true);
    try {
      const saved = editingMilestone
        ? await bdApi.updateMilestone(editingMilestone._id, form)
        : await bdApi.addMilestone(form);
      const fresh = await bdApi.getMilestones({ scope: 'team' });
      setMilestones(fresh);
      setEditingMilestone(null);
      return saved;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await bdApi.deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      alert(`Error deleting milestone: ${err.message}`);
    }
  };

  // The sweep is cron'd for 07:00 daily on the server, but a host that sleeps
  // can miss it — and after logging a batch of work you often want the queue
  // recomputed now rather than tomorrow.
  const runSweep = async () => {
    setSweeping(true);
    try {
      await bdApi.evaluateReminders();
      const fresh = await bdApi.getReminders();
      // Same filter the initial load uses — narrowing it here made tender and
      // client reminders vanish the moment somebody pressed Check now.
      setReminders(fresh.filter((r) => r.sourceType !== 'Campaign'));
    } catch (err) {
      alert(`Could not run the reminder sweep: ${err.message}`);
    } finally {
      setSweeping(false);
    }
  };

  const [reschedulingReminder, setReschedulingReminder] = useState(null);
  const [completingReminder, setCompletingReminder] = useState(null);

  const dismissReminder = async (id) => {
    try {
      await bdApi.actionReminder(id);
      setReminders((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert(`Error dismissing reminder: ${err.message}`);
    }
  };

  const handleRescheduled = async (id, data) => {
    await bdApi.rescheduleReminder(id, data);
    setReminders((prev) => prev.filter((r) => r._id !== id));
    const fresh = await bdApi.getReminders();
    setReminders(fresh.filter((r) => r.sourceType !== 'Campaign'));
  };

  const handleCompleted = async (id, data) => {
    await bdApi.completeReminder(id, data);
    setReminders((prev) => prev.filter((r) => r._id !== id));
    const fresh = await bdApi.getReminders();
    setReminders(fresh.filter((r) => r.sourceType !== 'Campaign'));
  };

  // Flatten records into celebrations: a team member yields both a birthday
  // and a work anniversary, and each wants its own row on its own date.
  const celebrations = milestones.flatMap((m) =>
    (m.occurrences || []).map((o) => ({ record: m, occ: o }))
  ).sort((a, b) => a.occ.daysUntil - b.occ.daysUntil);

  const teamBirthdays = celebrations.filter(
    (c) => c.occ.kind === 'Birthday' && c.record.milestoneType === 'Team Member'
  );
  const externalBirthdays = celebrations.filter(
    (c) => c.occ.kind === 'Birthday' && c.record.milestoneType !== 'Team Member'
  );
  const workMilestones = celebrations.filter((c) => c.occ.kind === 'Milestone');
  const drafts = milestones.filter((m) => m.isDraft);
  const refreshMedia = async () => setMedia(await bdApi.getMediaArchive());

  const handleDeleteMedia = async (item) => {
    if (!window.confirm(`Remove "${item.label || 'this item'}" from the archive?`)) return;
    try {
      await bdApi.deleteMediaItem(item.ownerType, item.ownerId, item._id);
      setMedia((prev) => prev.filter((m) => m._id !== item._id));
    } catch (err) {
      alert(`Error removing media: ${err.message}`);
    }
  };

  // Restructured Celebration Card Component
  const renderCelebration = ({ record: m, occ }) => {
    const isBirthday = occ.kind === 'Birthday';
    const isToday = occ.daysUntil === 0;
    const isSoon = occ.daysUntil !== null && occ.daysUntil <= 7;

    return (
      <button
        key={`${m._id}-${occ.kind}-${occ.month}-${occ.day}`}
        type="button"
        onClick={() => setViewingMilestone(m)}
        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden ${
          isToday
            ? 'bg-gradient-to-r from-amber-500/10 via-amber-50 to-white border-amber-300 ring-1 ring-amber-400/30 shadow-2xs'
            : isSoon
            ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400 hover:shadow-xs'
            : 'bg-white border-slate-200/90 hover:border-navy-300 hover:shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 shadow-2xs ${
              isBirthday
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                : 'bg-gradient-to-br from-navy-800 to-slate-900 text-white'
            }`}
          >
            {isBirthday ? '🎂' : '🎗'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-navy-950 group-hover:text-navy-700 transition-colors truncate">
                {m.participantName}
              </h4>
              {m.isDraft && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 uppercase">
                  DRAFT
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
              {isBirthday
                ? `Birthday · ${MONTHS[occ.month - 1]} ${occ.day}`
                : `${occ.years ? `${occ.years} Year${occ.years === 1 ? '' : 's'}` : occ.label} · ${MONTHS[occ.month - 1]} ${occ.day}`}
              {m.departmentOrCompany ? ` · ${m.departmentOrCompany}` : ''}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {occ.daysUntil !== null && occ.daysUntil <= 14 ? (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isToday
                  ? 'bg-emerald-600 text-white shadow-2xs animate-pulse'
                  : occ.daysUntil <= 3
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isToday ? '🎉 TODAY!' : `${occ.daysUntil}d`}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              {MONTHS[occ.month - 1]} {occ.day}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Events & Business Forums</h1>
        <p className="text-sm text-slate-600">Conferences, DG briefings, webinars and podcasts — plus team culture and the flagship annual summit.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab.key ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to connect to backend: {error}</div>}

      {activeTab === 'dg' ? (
        <DgEventWorkspace />
      ) : activeTab === 'holidays' ? (
        <GhanaHolidaysWorkspace />
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">🔔 Reminders ({reminders.length})</h4>
                <button
                  type="button"
                  onClick={runSweep}
                  disabled={sweeping}
                  className="text-xs font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer disabled:opacity-50"
                >
                  {sweeping ? 'Checking…' : 'Check now'}
                </button>
              </div>
              {reminders.length === 0 && (
                <p className="text-xs text-amber-700">Nothing needs chasing right now.</p>
              )}
              <div className="space-y-1.5">
                {reminders.map((r) => {
                  const isOverdue = r.reminderType === 'overdue';
                  const isToday = r.reminderType === 'today';
                  return (
                    <div
                      key={r._id}
                      className={`flex flex-wrap items-start justify-between gap-3 bg-white border rounded-lg px-3 py-2 ${
                        isOverdue ? 'border-red-300 border-l-4 border-l-red-600 bg-red-50/20' : 'border-amber-100 border-l-4 border-l-amber-500'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded ${
                            isOverdue ? 'bg-red-100 text-red-800' : isToday ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isOverdue ? 'MISSED / OVERDUE' : isToday ? 'TODAY' : 'UPCOMING'}
                          </span>
                          <span className="text-xs text-slate-500">{r.sourceType}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{r.message}</p>
                        {r.responsiblePerson && <p className="text-xs text-slate-500">Owner: {r.responsiblePerson}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCompletingReminder(r)}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                        >
                          ✅ Mark Met
                        </button>
                        <button
                          type="button"
                          onClick={() => setReschedulingReminder(r)}
                          className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
                        >
                          📅 Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissReminder(r._id)}
                          className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                          title="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6 items-start">
            {/* Left zone — operational events */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-navy-900">Upcoming Forums & Events</h2>
                <Button variant="primary" onClick={() => { setEditingEvent(null); setShowWizard(true); }}>
                  + New Event / Forum / Media
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EVENT_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      filter === f.key
                        ? 'bg-navy-700 text-white border-navy-700'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-navy-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}</div>
              ) : visibleEvents.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
                  {events.length === 0 ? 'No events yet. Create one to get started.' : 'No events match this filter.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleEvents.map((e) => (
                    <EventCard
                      key={e._id}
                      event={e}
                      onEdit={(ev) => { setEditingEvent(ev); setShowWizard(true); }}
                      onDelete={handleDeleteEvent}
                      onToggleTask={handleToggleTask}
                      onUpdateAttendee={handleUpdateAttendee}
                      onEnterMetrics={setMetricsEvent}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right zone — culture, stakeholders, media */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-navy-900">Celebrations &amp; Media Hub</h2>
                <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={() => { setEditingMilestone(null); setShowMilestone(true); }}>
                  + Milestone
                </Button>
              </div>

              {/* 1. Team Birthdays Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎂</span> Team Birthdays ({teamBirthdays.length})
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                    Internal
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {teamBirthdays.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                      <p className="text-xs font-medium text-slate-500">No team birthdays recorded yet.</p>
                    </div>
                  ) : (
                    teamBirthdays.map(renderCelebration)
                  )}
                </div>
              </div>

              {/* 2. Partner & VIP Birthdays Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🤝</span> Partner &amp; VIP Birthdays ({externalBirthdays.length})
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                    Stakeholders
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {externalBirthdays.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                      <p className="text-xs font-medium text-slate-500">No partner or VIP birthdays recorded yet.</p>
                    </div>
                  ) : (
                    externalBirthdays.map(renderCelebration)
                  )}
                </div>
              </div>

              {/* 3. Work & Service Milestones Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎗</span> Work &amp; Service Milestones ({workMilestones.length})
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                    Anniversaries
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {workMilestones.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                      <p className="text-xs font-medium text-slate-500">No milestones recorded yet.</p>
                    </div>
                  ) : (
                    workMilestones.map(renderCelebration)
                  )}
                  {drafts.length > 0 && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                      ⚠️ {drafts.length === 1
                        ? '1 milestone draft still needs a date assigned.'
                        : `${drafts.length} milestone drafts still need a date assigned.`}
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Media Hub & Institutional Memory Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎬</span> Media Hub &amp; Archive ({media.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Photos, podcasts, audio recordings, and asset links</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMedia(true)}
                    className="text-xs font-semibold text-navy-800 hover:text-navy-950 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    + Add Media
                  </button>
                </div>
                <div className="p-4">
                  {media.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                      <span className="text-2xl block mb-1">📸</span>
                      <p className="text-xs font-semibold text-slate-700">No media archived yet</p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Upload celebration photos, podcast audio recordings, or attach links to event assets.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {media.map((m) => (
                        <div
                          key={m._id}
                          className="group relative border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/60 hover:bg-white hover:border-navy-300 hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="block p-2.5">
                            {m.kind === 'Photo' ? (
                              <div className="relative overflow-hidden rounded-lg h-24 bg-slate-100">
                                <img
                                  src={m.url}
                                  alt={m.label || m.context}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  📷 Photo
                                </span>
                              </div>
                            ) : m.kind === 'Audio' ? (
                              <div className="h-24 rounded-lg bg-gradient-to-br from-purple-900 via-purple-950 to-slate-900 text-white flex flex-col items-center justify-center p-2 text-center">
                                <span className="text-2xl animate-pulse">🎙</span>
                                <span className="text-[10px] font-bold text-purple-200 mt-1 truncate max-w-full">
                                  Podcast / Audio
                                </span>
                              </div>
                            ) : (
                              <div className="h-24 rounded-lg bg-gradient-to-br from-navy-900 to-slate-800 text-white flex flex-col items-center justify-center p-2 text-center">
                                <span className="text-2xl">
                                  {m.kind === 'Video' ? '🎬' : m.kind === 'Document' ? '📄' : '🔗'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-300 mt-1 truncate max-w-full">
                                  {m.kind}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-navy-950 font-bold truncate mt-2 group-hover:text-navy-700">
                              {m.label || m.kind}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {m.context || 'Institutional asset'}
                            </p>
                          </a>
                          {m.kind === 'Audio' && (
                            <div className="px-2 pb-2">
                              <audio controls src={m.url} className="w-full h-7 rounded" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(m)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow-2xs border border-slate-200 text-red-600 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-50"
                            aria-label="Remove media"
                            title="Remove media"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <EventWizardModal
        key={editingEvent?._id || 'new-event'}
        open={showWizard}
        onClose={() => { setShowWizard(false); setEditingEvent(null); }}
        onSubmit={handleEventSubmit}
        submitting={submitting}
        initialData={editingEvent}
        scripts={scripts}
        campaigns={campaigns}
      />

      <EventMetricsModal
        key={metricsEvent?._id || 'metrics'}
        open={!!metricsEvent}
        onClose={() => setMetricsEvent(null)}
        event={metricsEvent}
        onUpdated={upsertEvent}
      />

      <AddMediaModal
        open={showMedia}
        onClose={() => setShowMedia(false)}
        events={events}
        milestones={milestones}
        onSaved={refreshMedia}
      />

      <MilestoneModal
        key={editingMilestone?._id || 'new-milestone'}
        open={showMilestone}
        onClose={() => { setShowMilestone(false); setEditingMilestone(null); }}
        onSubmit={handleMilestoneSubmit}
        submitting={submitting}
        initialData={editingMilestone}
      />

      {/* Clicking any celebration opens the whole person, not just the date
          that happened to be listed. */}
      <Modal
        open={!!viewingMilestone}
        onClose={() => setViewingMilestone(null)}
        title={viewingMilestone?.participantName}
        description={viewingMilestone?.role || viewingMilestone?.departmentOrCompany || ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="danger"
              onClick={() => { handleDeleteMilestone(viewingMilestone._id); setViewingMilestone(null); }}
            >
              Delete
            </Button>
            <Button
              variant="primary"
              onClick={() => { setEditingMilestone(viewingMilestone); setViewingMilestone(null); setShowMilestone(true); }}
            >
              ✎ Edit
            </Button>
          </div>
        }
      >
        {viewingMilestone && (
          <div className="space-y-3">
            {viewingMilestone.isDraft && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Saved as a draft — it will not be chased until the required date is filled in.
              </p>
            )}

            <dl className="text-sm">
              <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Type</dt>
                <dd className="text-navy-900">{viewingMilestone.milestoneType}</dd>
              </div>
              {viewingMilestone.departmentOrCompany && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Department / Organisation</dt>
                  <dd className="text-navy-900">{viewingMilestone.departmentOrCompany}</dd>
                </div>
              )}
              {viewingMilestone.role && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Role</dt>
                  <dd className="text-navy-900">{viewingMilestone.role}</dd>
                </div>
              )}
              {viewingMilestone.originalStartDate && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Started</dt>
                  <dd className="text-navy-900">
                    {new Date(viewingMilestone.originalStartDate).toLocaleDateString(undefined,
                      { day: '2-digit', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
              )}
            </dl>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                What is coming up
              </p>
              <div className="space-y-1.5">
                {(viewingMilestone.occurrences || []).map((o) => (
                  <div key={`${o.kind}-${o.month}-${o.day}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-sm text-navy-900 flex items-center gap-2">
                      <CelebrationIcon
                        kind={o.kind}
                        milestoneType={viewingMilestone.milestoneType}
                        className={`w-4 h-4 shrink-0 ${o.kind === 'Birthday' ? 'text-amber-500' : 'text-navy-600'}`}
                      />
                      {o.kind === 'Birthday' ? 'Birthday' : o.label}
                      {o.years ? ` — ${o.years} year${o.years === 1 ? '' : 's'}` : ''}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {MONTHS[o.month - 1]} {o.day} · {o.daysUntil === 0 ? 'today' : `in ${o.daysUntil} day(s)`}
                    </span>
                  </div>
                ))}
                {(viewingMilestone.occurrences || []).length === 0 && (
                  <p className="text-xs text-slate-400">Nothing dated yet.</p>
                )}
              </div>
            </div>

            {viewingMilestone.favouriteQuote && (
              <p className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3">
                “{viewingMilestone.favouriteQuote}”
              </p>
            )}
            {viewingMilestone.notes && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingMilestone.notes}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Resolution Modals */}
      {reschedulingReminder && (
        <RescheduleReminderModal
          open={!!reschedulingReminder}
          onClose={() => setReschedulingReminder(null)}
          reminder={reschedulingReminder}
          onRescheduled={handleRescheduled}
        />
      )}

      {completingReminder && (
        <CompleteReminderModal
          open={!!completingReminder}
          onClose={() => setCompletingReminder(null)}
          reminder={completingReminder}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
};

export default EventsModule;
