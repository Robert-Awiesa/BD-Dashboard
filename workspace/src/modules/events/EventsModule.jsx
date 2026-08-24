import { useEffect, useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import CelebrationIcon from './celebrationIcons';
import EventCard from './EventCard';
import EventWizardModal from './EventWizardModal';
import EventMetricsModal from './EventMetricsModal';
import MilestoneModal from './MilestoneModal';
import DgEventWorkspace from './DgEventWorkspace';
import AddMediaModal from './AddMediaModal';
import { EVENT_FILTERS, MONTHS } from './eventConstants';

const TABS = [
  { key: 'hub', label: 'Operational Hub' },
  { key: 'dg', label: 'DG Annual Event' },
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
      setReminders(fresh.filter((r) => ['Event', 'Milestone'].includes(r.sourceType)));
    } catch (err) {
      alert(`Could not run the reminder sweep: ${err.message}`);
    } finally {
      setSweeping(false);
    }
  };

  const dismissReminder = async (id) => {
    try {
      await bdApi.actionReminder(id);
      setReminders((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert(`Error dismissing reminder: ${err.message}`);
    }
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

  // A row is one celebration, not one record. Clicking it opens the person.
  const renderCelebration = ({ record: m, occ }) => (
    <button
      key={`${m._id}-${occ.kind}-${occ.month}-${occ.day}`}
      type="button"
      onClick={() => setViewingMilestone(m)}
      className="w-full text-left flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-4 px-4 cursor-pointer transition-colors"
    >
      <CelebrationIcon
        kind={occ.kind}
        milestoneType={m.milestoneType}
        className={`w-5 h-5 shrink-0 mt-0.5 ${occ.kind === 'Birthday' ? 'text-amber-500' : 'text-navy-600'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-navy-900 font-medium truncate">
          {m.participantName}
          {m.isDraft && <span className="ml-1.5 text-[10px] text-amber-700 font-semibold">DRAFT</span>}
        </p>
        {/* Say plainly what is being celebrated and how long it has been —
            "5 years on 01 Sept" rather than a bare date and a "5 yr" chip. */}
        <p className="text-xs text-slate-500">
          {occ.kind === 'Birthday'
            ? `Birthday · ${MONTHS[occ.month - 1]} ${occ.day}`
            : `${occ.years ? `${occ.years} year${occ.years === 1 ? '' : 's'}` : occ.label} · ${MONTHS[occ.month - 1]} ${occ.day}`}
          {m.departmentOrCompany ? ` · ${m.departmentOrCompany}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        {occ.daysUntil !== null && occ.daysUntil <= 7 && (
          <Badge
            label={occ.daysUntil === 0 ? 'Today' : `${occ.daysUntil}d`}
            status={occ.daysUntil === 0 ? 'success' : 'ongoing'}
          />
        )}
      </div>
    </button>
  );

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
                {reminders.map((r) => (
                  <div key={r._id} className="flex items-start justify-between gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className={`text-xs font-medium ${r.reminderType === 'today' ? 'text-forest-700' : 'text-amber-700'}`}>
                        {r.reminderType === 'today' ? 'TODAY' : 'UPCOMING'} · {r.sourceType}
                      </span>
                      <p className="text-sm text-slate-700">{r.message}</p>
                      {r.responsiblePerson && <p className="text-xs text-slate-500">Owner: {r.responsiblePerson}</p>}
                    </div>
                    <button type="button" onClick={() => dismissReminder(r._id)} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer shrink-0">Dismiss</button>
                  </div>
                ))}
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

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Team Birthdays</h3>
                </div>
                <div className="px-4 py-1">
                  {teamBirthdays.length === 0
                    ? <p className="text-xs text-slate-400 py-3">No team birthdays recorded yet.</p>
                    : teamBirthdays.map(renderCelebration)}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Partner &amp; VIP Birthdays</h3>
                </div>
                <div className="px-4 py-1">
                  {externalBirthdays.length === 0
                    ? <p className="text-xs text-slate-400 py-3">No partner or VIP birthdays recorded yet.</p>
                    : externalBirthdays.map(renderCelebration)}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Milestones</h3>
                </div>
                <div className="px-4 py-1">
                  {workMilestones.length === 0
                    ? <p className="text-xs text-slate-400 py-3">No milestones recorded yet.</p>
                    : workMilestones.map(renderCelebration)}
                  {drafts.length > 0 && (
                    <p className="text-[11px] text-amber-700 py-2 border-t border-slate-100">
                      {drafts.length === 1
                        ? '1 draft still needs a date before it will be chased.'
                        : `${drafts.length} drafts still need a date before they will be chased.`}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Media Hub — Institutional Memory</h3>
                  <button
                    type="button"
                    onClick={() => setShowMedia(true)}
                    className="text-xs text-navy-700 hover:underline cursor-pointer shrink-0"
                  >
                    + Add media
                  </button>
                </div>
                <div className="p-4">
                  {media.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No media archived yet. Upload celebration photos or podcast audio, or attach a link to a recorded session.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {media.map((m) => (
                        <div key={m._id} className="group relative border border-slate-200 rounded-lg overflow-hidden hover:border-navy-300 transition-colors">
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="block p-2">
                            {m.kind === 'Photo' ? (
                              <img src={m.url} alt={m.label || m.context} className="w-full h-20 object-cover rounded" />
                            ) : m.kind === 'Audio' ? (
                              <div className="h-20 flex items-center justify-center bg-slate-50 rounded text-2xl">🎙</div>
                            ) : (
                              <div className="h-20 flex items-center justify-center bg-slate-50 rounded text-2xl">
                                {m.kind === 'Video' ? '🎬' : m.kind === 'Document' ? '📄' : '🔗'}
                              </div>
                            )}
                            <p className="text-[11px] text-slate-700 truncate mt-1 font-medium">{m.label || m.kind}</p>
                            <p className="text-[10px] text-slate-400 truncate">{m.context}</p>
                          </a>
                          {m.kind === 'Audio' && (
                            <audio controls src={m.url} className="w-full h-7 px-2 pb-2" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(m)}
                            className="absolute top-1 right-1 w-5 h-5 rounded bg-white/90 border border-slate-200 text-red-600 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            aria-label="Remove media"
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
    </div>
  );
};

export default EventsModule;
