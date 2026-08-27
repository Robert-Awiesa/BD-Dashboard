import { useEffect, useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const StatCard = ({ label, value, subtext, icon, highlight = false }) => (
  <div
    className={`rounded-xl border p-4 transition-all shadow-sm ${
      highlight
        ? 'bg-gradient-to-br from-amber-900/40 via-amber-950/20 to-slate-900 border-amber-500/40 text-amber-100'
        : 'bg-white border-slate-200 text-slate-800'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-lg">{icon}</span>
    </div>
    <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-amber-400' : 'text-navy-950'}`}>{value}</p>
    {subtext && <p className="text-[11px] text-slate-500 mt-0.5">{subtext}</p>}
  </div>
);

const safeIsoDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const formatShortDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const getRelativeDays = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target - today) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
};

const GhanaHolidaysWorkspace = () => {
  const [holidays, setHolidays] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'calendar'

  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Month navigation for Calendar view
  const [currentCalMonth, setCurrentCalMonth] = useState(new Date().getMonth());

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        bdApi.getHolidays({ year, status: statusFilter, search }),
        bdApi.getHolidayStats(),
      ]);
      setHolidays(Array.isArray(list) ? list : []);
      setStats(s);
      setError(null);
    } catch (err) {
      setHolidays([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [year, statusFilter, search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await bdApi.syncHolidays(year);
      await loadHolidays();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveNotes = async (e) => {
    e.preventDefault();
    if (!selectedHoliday) return;
    setSavingNotes(true);
    try {
      const updated = await bdApi.updateHoliday(selectedHoliday._id, { notes: editingNotes });
      setHolidays((prev) => (Array.isArray(prev) ? prev.map((h) => (h && h._id === updated._id ? updated : h)) : []));
      setSelectedHoliday(null);
    } catch (err) {
      alert(`Error saving notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const activeAlerts = useMemo(
    () => (Array.isArray(holidays) ? holidays.filter((h) => h && h.status === 'Active Reminder') : []),
    [holidays]
  );

  // --- Calendar Grid Helpers ---
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, currentCalMonth, 1);
    const lastDay = new Date(year, currentCalMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null); // padding empty slots
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, currentCalMonth, d);
      const key = safeIsoDate(dateObj);
      const matchedHolidays = (Array.isArray(holidays) ? holidays : []).filter((h) => {
        if (!h || !h.date) return false;
        return safeIsoDate(h.date) === key;
      });
      days.push({ dayNumber: d, dateObj, holidays: matchedHolidays });
    }
    return days;
  }, [year, currentCalMonth, holidays]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🇬🇭</span>
              <h2 className="text-xl font-bold tracking-tight text-white">Ghana Public Holidays Calendar</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Official Ghana public holidays automatically synced with 7-day advance reminder alerts. Reminders stay active until the holiday passes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleSync}
              disabled={syncing}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs px-3 py-2"
            >
              {syncing ? '🔄 Syncing…' : '🔄 Sync Ghana Holidays'}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 relative z-10">
          <StatCard
            label="Active 7-Day Alerts"
            value={stats?.activeRemindersCount || 0}
            subtext="Holidays triggering 7-day countdown notice"
            icon="🔔"
            highlight={stats?.activeRemindersCount > 0}
          />
          <StatCard
            label="Upcoming Holidays"
            value={stats?.upcomingCount || 0}
            subtext={`Total upcoming public holidays in ${year}`}
            icon="📅"
          />
          <StatCard
            label="Next Ghana Holiday"
            value={stats && stats.daysToNext != null ? (stats.daysToNext === 0 ? 'Today!' : `${stats.daysToNext} days`) : '—'}
            subtext={stats?.nextHoliday ? stats.nextHoliday.name : 'No more upcoming this year'}
            icon="🇬🇭"
          />
        </div>
      </div>

      {/* Active 7-Day Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <span className="animate-pulse">🔔</span> 7-Day Advance Holiday Notice Active ({activeAlerts.length})
            </h3>
            <span className="text-[11px] font-medium bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              Automated Alert Window
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeAlerts.map((h) => (
              <div key={h._id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-navy-950">🇬🇭 {h.name}</span>
                  <p className="text-xs text-amber-900 mt-0.5">{formatDate(h.date)} ({getRelativeDays(h.date)})</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Plan team schedules, client deliverables, and leave coverage.
                  </p>
                </div>
                <Badge label={getRelativeDays(h.date)} status="warn" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar & View Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search holiday name, notes…"
              className="form-input text-xs sm:w-64"
            />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="form-input text-xs w-28"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y} Holidays</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input text-xs w-40"
            >
              <option value="">All Statuses</option>
              <option value="Active Reminder">Active 7-Day Alert</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Passed">Passed</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-navy-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎴 Cards Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white text-navy-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Calendar View
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {/* Mode 1: Cards Grid */}
      {viewMode === 'grid' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 skeleton rounded-xl" />
              ))}
            </div>
          ) : holidays.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <span className="text-3xl">🇬🇭</span>
              <h3 className="text-base font-semibold text-navy-950 mt-2">No Ghana holidays found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click &ldquo;Sync Ghana Holidays&rdquo; above to fetch official public holidays for {year}.
              </p>
              <div className="mt-4">
                <Button variant="primary" onClick={handleSync} disabled={syncing}>
                  {syncing ? 'Syncing…' : '🔄 Sync Ghana Holidays'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidays.map((h) => {
                const isActive = h.status === 'Active Reminder';
                const isPassed = h.status === 'Passed';
                return (
                  <div
                    key={h._id}
                    className={`rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition-all ${
                      isActive
                        ? 'bg-gradient-to-b from-amber-50/50 to-white border-amber-300 ring-1 ring-amber-400/30'
                        : isPassed
                        ? 'bg-slate-50/70 border-slate-200 opacity-75'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-navy-950 flex items-center gap-1.5">
                          🇬🇭 {h.name}
                        </span>
                        {isActive ? (
                          <Badge label="7-Day Alert" status="warn" />
                        ) : isPassed ? (
                          <Badge label="Passed" status="cold" />
                        ) : (
                          <Badge label="Upcoming" status="info" />
                        )}
                      </div>

                      <p className="text-xs font-medium text-emerald-800 mt-2 flex items-center gap-1">
                        <span>📅</span> {formatDate(h.date)}
                        <span className="text-slate-400">({getRelativeDays(h.date)})</span>
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                        <div className="flex justify-between">
                          <span>7-Day Trigger Date:</span>
                          <span className="font-medium text-slate-700">{formatShortDate(h.notificationTriggerDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reminder Active:</span>
                          <span className={h.reminderActive ? 'font-semibold text-emerald-700' : 'text-slate-400'}>
                            {h.reminderActive ? 'Yes (Until Holiday)' : 'No'}
                          </span>
                        </div>
                      </div>

                      {h.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-3 italic line-clamp-2">
                          “{h.notes}”
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHoliday(h);
                          setEditingNotes(h.notes || '');
                        }}
                        className="text-xs font-medium text-purple-700 hover:text-purple-900 cursor-pointer"
                      >
                        {h.notes ? '✎ Edit Notes' : '+ Add Team Note'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Mode 2: Interactive Month Calendar */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-navy-950">
                {monthNames[currentCalMonth]} {year}
              </h3>
              <span className="text-xs text-slate-500">Ghana Public Holidays</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentCalMonth((m) => (m === 0 ? 11 : m - 1))}
                className="px-3 py-1 text-xs border rounded bg-white hover:bg-slate-50 cursor-pointer"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentCalMonth(new Date().getMonth())}
                className="px-3 py-1 text-xs border rounded bg-white hover:bg-slate-50 cursor-pointer font-medium"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentCalMonth((m) => (m === 11 ? 0 : m + 1))}
                className="px-3 py-1 text-xs border rounded bg-white hover:bg-slate-50 cursor-pointer"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 rounded">
                {d}
              </div>
            ))}

            {calendarDays.map((item, idx) => {
              if (!item) {
                return <div key={`empty-${idx}`} className="h-24 bg-slate-50/40 rounded border border-transparent" />;
              }
              const isToday =
                item.dateObj.getDate() === new Date().getDate() &&
                item.dateObj.getMonth() === new Date().getMonth() &&
                item.dateObj.getFullYear() === new Date().getFullYear();

              return (
                <div
                  key={item.dayNumber}
                  className={`h-24 p-1.5 border rounded-lg flex flex-col justify-between text-left transition-colors ${
                    isToday ? 'bg-navy-50/50 border-navy-300 ring-1 ring-navy-400/40' : 'bg-white border-slate-200'
                  }`}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-navy-900 bg-navy-100 w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                    {item.dayNumber}
                  </span>

                  <div className="space-y-1 overflow-y-auto max-h-16">
                    {item.holidays.map((h) => (
                      <button
                        key={h._id}
                        type="button"
                        onClick={() => {
                          setSelectedHoliday(h);
                          setEditingNotes(h.notes || '');
                        }}
                        className="w-full text-left bg-emerald-700 hover:bg-emerald-800 text-white p-1 rounded text-[10px] font-semibold truncate block cursor-pointer transition-colors"
                        title={`${h.name} (${h.status})`}
                      >
                        🇬🇭 {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Notes Modal */}
      {selectedHoliday && (
        <Modal
          open={!!selectedHoliday}
          onClose={() => setSelectedHoliday(null)}
          title={`🇬🇭 ${selectedHoliday.name}`}
          description={`Ghana Public Holiday · ${formatDate(selectedHoliday.date)}`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedHoliday(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveNotes} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-navy-950">{selectedHoliday.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Notification Trigger Date:</span>
                <span className="font-medium text-slate-800">{formatDate(selectedHoliday.notificationTriggerDate)} (7 days prior)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reminder Active Window:</span>
                <span className="font-medium text-slate-800">Trigger Date → Holiday Date</span>
              </div>
            </div>

            <div>
              <label className="form-label">Team Planning Notes</label>
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                rows={4}
                placeholder="e.g. Office closed. Emergency client contact assigned to Kwesi."
                className="form-input text-xs"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default GhanaHolidaysWorkspace;
