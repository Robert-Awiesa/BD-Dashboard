import { useState, useMemo } from 'react';
import Button from '../../../components/common/Button';

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

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CATEGORY_STYLES = {
  AWS: { badge: 'bg-amber-50 text-amber-800 border-amber-200', icon: '☁️' },
  SAP: { badge: 'bg-blue-50 text-blue-800 border-blue-200', icon: '🏢' },
  Esri: { badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: '🗺️' },
  OpenText: { badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: '📁' },
  'BD / Tender': { badge: 'bg-purple-50 text-purple-800 border-purple-200', icon: '🏛️' },
  'General Tech': { badge: 'bg-slate-100 text-slate-800 border-slate-200', icon: '💻' },
  Other: { badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: '✨' },
};

const TrainingScheduleTab = ({
  schedules = [],
  trainings = [],
  loading,
  year,
  setYear,
  onEdit,
  onDelete,
  onArchive,
  onOpenCreate,
  onLaunchTraining,
  onEditTraining,
}) => {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'grid'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentCalMonth, setCurrentCalMonth] = useState(new Date().getMonth());
  const [selectedItem, setSelectedItem] = useState(null);

  const CATEGORIES = ['All', 'AWS', 'SAP', 'Esri', 'OpenText', 'BD / Tender', 'General Tech'];

  // Unified items list — deduplicated so a logged training never appears twice
  const unifiedItems = useMemo(() => {
    // 1. Scheduled awareness items — only pure roadmap items (NOT linked to a training)
    // Items with status 'Logged as Training' are represented by the training entry below
    const schedItems = schedules
      .filter((s) => s.status !== 'Logged as Training')
      .map((s) => ({
        _id: s._id,
        itemType: 'schedule',
        title: s.title,
        date: s.targetDate,
        category: s.category || 'Other',
        subtitle: s.targetGroup,
        note: s.note,
        status: s.status,
        raw: s,
      }));

    // 2. All logged trainings — shown as the canonical entry
    const loggedTrainings = trainings.map((t) => {
      // Infer vendor category from title or organizers for richer visual
      const org = (t.externalDetails?.organizers || '').toLowerCase();
      const ttl = (t.title || '').toLowerCase();
      let category = t.type === 'Internal' ? 'General Tech' : 'Other';
      if (org.includes('aws') || ttl.includes('aws')) category = 'AWS';
      else if (org.includes('sap') || ttl.includes('sap')) category = 'SAP';
      else if (org.includes('esri') || ttl.includes('esri') || ttl.includes('gis')) category = 'Esri';
      else if (org.includes('opentext') || ttl.includes('opentext')) category = 'OpenText';
      else if (ttl.includes('tender') || ttl.includes('bid') || ttl.includes('proposal')) category = 'BD / Tender';

      return {
        _id: t._id,
        itemType: 'training',
        title: t.title,
        date: t.dateRange?.start,
        category,
        subtitle: t.type === 'Internal'
          ? `Lead: ${t.facilitator || 'Team'}`
          : `Vendor: ${t.externalDetails?.organizers || 'External'}`,
        note: t.description || t.takeaways,
        status: t.progress,
        participantsCount: t.participants?.length || 0,
        raw: t,
      };
    });

    return [...schedItems, ...loggedTrainings];
  }, [schedules, trainings]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchSub = (item.subtitle || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchNote) return false;
      }
      return true;
    });
  }, [unifiedItems, categoryFilter, search]);

  // Calendar Day slots builder
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, currentCalMonth, 1);
    const lastDay = new Date(year, currentCalMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, currentCalMonth, d);
      const key = safeIsoDate(dateObj);
      const matched = filteredItems.filter((it) => {
        if (!it.date) return false;
        return safeIsoDate(it.date) === key;
      });
      days.push({ dayNumber: d, dateObj, items: matched });
    }
    return days;
  }, [year, currentCalMonth, filteredItems]);

  return (
    <div className="space-y-6">
      {/* Category Pills & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          {CATEGORIES.map((cat) => {
            const isSelected = categoryFilter === cat;
            const style = CATEGORY_STYLES[cat];
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-navy-950 shadow-2xs border border-slate-200/60 font-bold'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                <span>{cat === 'All' ? '🌐 All' : style?.icon}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        <Button
          variant="primary"
          onClick={() => onOpenCreate(new Date(year, currentCalMonth, 15))}
        >
          <span>+</span> Add Training Awareness
        </Button>
      </div>

      {/* Filter Toolbar & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
            <span className="text-slate-400 text-sm pl-1">🔍</span>
            <input
              type="text"
              placeholder="Search training themes, target groups, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs text-navy-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none"
          >
            {[2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y} Calendar
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-white text-navy-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <span>📅</span>
            <span>Calendar View</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'grid'
                ? 'bg-white text-navy-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <span>🎴</span>
            <span>Timeline Cards</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm font-medium text-slate-600">Loading training calendar...</p>
        </div>
      ) : filteredItems.length === 0 && search ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-3xl">🔍</span>
          <h3 className="text-base font-bold text-navy-950 mt-2">No items match &ldquo;{search}&rdquo;</h3>
          <p className="text-xs text-slate-500 mt-1">Try another search keyword or clear filters.</p>
        </div>
      ) : viewMode === 'calendar' ? (
        /* MODE 1: INTERACTIVE MONTH CALENDAR */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-navy-950 tracking-tight">
                {monthNames[currentCalMonth]} {year}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                ({filteredItems.filter((s) => s.date && new Date(s.date).getMonth() === currentCalMonth).length} events)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentCalMonth((m) => (m === 0 ? 11 : m - 1))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentCalMonth(new Date().getMonth())}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-navy-900 cursor-pointer shadow-2xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentCalMonth((m) => (m === 11 ? 0 : m + 1))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-lg border border-slate-100"
              >
                {d}
              </div>
            ))}

            {calendarDays.map((item, idx) => {
              if (!item) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[105px] bg-slate-50/40 rounded-xl border border-transparent"
                  />
                );
              }

              const isToday =
                new Date().getDate() === item.dayNumber &&
                new Date().getMonth() === currentCalMonth &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={`day-${item.dayNumber}`}
                  onClick={() => onOpenCreate(item.dateObj)}
                  className={`min-h-[105px] p-2 rounded-xl border transition-all text-left flex flex-col justify-between group cursor-pointer ${
                    isToday
                      ? 'bg-blue-50/40 border-navy-300 ring-1 ring-navy-400/30'
                      : item.items.length > 0
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                      : 'bg-white/60 border-slate-100 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-navy-900 text-white'
                          : 'text-slate-700 group-hover:text-navy-950'
                      }`}
                    >
                      {item.dayNumber}
                    </span>
                    <span className="text-[10px] text-slate-300 group-hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                      +
                    </span>
                  </div>

                  <div className="space-y-1 mt-1 flex-1">
                    {item.items.map((it) => {
                      if (it.itemType === 'training') {
                        return (
                          <div
                            key={it._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTraining(it.raw);
                            }}
                            className="p-1.5 rounded-lg text-[10px] font-semibold border leading-tight transition-all shadow-2xs bg-navy-50 text-navy-900 border-navy-200 hover:bg-navy-100"
                            title={`Logged Training: ${it.title}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-bold">
                                🎓 {it.title}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 bg-navy-200 text-navy-950 rounded">
                                {it.participantsCount}p
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Scheduled awareness item
                      const style = CATEGORY_STYLES[it.category] || CATEGORY_STYLES.Other;
                      const isLogged = it.status === 'Logged as Training';
                      return (
                        <div
                          key={it._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(it);
                          }}
                          className={`p-1.5 rounded-lg text-[10px] font-semibold border leading-tight transition-all shadow-2xs ${
                            isLogged
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 opacity-80'
                              : `${style.badge} hover:brightness-95`
                          }`}
                          title={`${it.title} (${it.subtitle})`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">
                              {style.icon} {it.title}
                            </span>
                            {isLogged && <span>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* MODE 2: TIMELINE CARDS */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              No training awareness or logged events found for {year}. Click &ldquo;+ Add Training Awareness&rdquo; to place a notice.
            </div>
          ) : (
            filteredItems.map((it) => {
              if (it.itemType === 'training') {
                return (
                  <div
                    key={it._id}
                    className="bg-white border border-navy-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:border-navy-300 transition-all bg-navy-50/20"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-navy-50 text-navy-800 border-navy-200 flex items-center gap-1">
                          <span>🎓</span>
                          <span>Active Logged Training</span>
                        </span>
                        <button
                          onClick={() => onEditTraining(it.raw)}
                          className="p-1 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded text-xs"
                          title="View / Edit Log"
                        >
                          ✏️
                        </button>
                      </div>

                      <h4 className="text-sm font-bold text-navy-950 mt-2 tracking-tight">
                        {it.title}
                      </h4>

                      <p className="text-xs text-navy-800 font-medium mt-1 flex items-center gap-1">
                        <span>📅</span> {formatDate(it.date)}
                        <span className="text-slate-400 font-normal">({getRelativeDays(it.date)})</span>
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {it.subtitle} &bull; <span className="font-semibold text-navy-900">{it.participantsCount} Attendees</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Status: <strong className="text-emerald-700">{it.status}</strong></span>
                      <button
                        onClick={() => onEditTraining(it.raw)}
                        className="text-xs font-semibold text-navy-700 hover:underline"
                      >
                        View Attendees & Takeaways &rarr;
                      </button>
                    </div>
                  </div>
                );
              }

              const style = CATEGORY_STYLES[it.category] || CATEGORY_STYLES.Other;
              const isLogged = it.status === 'Logged as Training';
              return (
                <div
                  key={it._id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${style.badge}`}>
                        <span>{style.icon}</span>
                        <span>{it.category}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(it.raw)}
                          className="p-1 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded text-xs"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onArchive(it.raw)}
                          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded text-xs cursor-pointer"
                          title={it.raw.archived ? 'Put back on the roadmap' : 'Archive'}
                        >
                          {it.raw.archived ? '↩️' : '📦'}
                        </button>
                        {it.raw.archived && (
                          <button
                            onClick={() => onDelete(it.raw)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded text-xs cursor-pointer"
                            title="Delete for good"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-navy-950 mt-2 tracking-tight">
                      {it.title}
                    </h4>

                    <p className="text-xs text-navy-800 font-medium mt-1 flex items-center gap-1">
                      <span>📅</span> {formatDate(it.date)}
                      <span className="text-slate-400 font-normal">({getRelativeDays(it.date)})</span>
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-semibold text-slate-600">For:</span> {it.subtitle}
                    </p>

                    {it.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2 italic">
                        &ldquo;{it.note}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {isLogged ? (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <span>✓</span> Logged as Training
                      </span>
                    ) : (
                      <button
                        onClick={() => onLaunchTraining(it.raw)}
                        className="text-xs font-semibold text-navy-700 hover:text-navy-950 flex items-center gap-1"
                      >
                        <span>📝</span> Log Attendees for this &rarr;
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Selected Day Quick Card Popover (Calendar View) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Training Awareness
                </span>
                <h3 className="text-base font-bold text-navy-950 mt-0.5">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Date:</span>
                <span className="font-bold text-navy-900">{formatDate(selectedItem.date)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Category:</span>
                <span className="font-bold text-navy-900">{selectedItem.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Target Group:</span>
                <span className="font-bold text-navy-900">{selectedItem.subtitle}</span>
              </div>
              {selectedItem.note && (
                <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 italic">
                  &ldquo;{selectedItem.note}&rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const it = selectedItem.raw;
                  setSelectedItem(null);
                  if (it.archived) onDelete(it);
                  else onArchive(it);
                }}
                className={`text-xs font-medium cursor-pointer ${
                  selectedItem.raw.archived
                    ? 'text-red-600 hover:text-red-800'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                {selectedItem.raw.archived ? 'Delete for good' : 'Archive'}
              </button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setSelectedItem(null)}>
                  Close
                </Button>
                {selectedItem.status !== 'Logged as Training' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const it = selectedItem.raw;
                      setSelectedItem(null);
                      onLaunchTraining(it);
                    }}
                  >
                    📝 Log Attendees
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingScheduleTab;
