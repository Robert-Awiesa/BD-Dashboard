import { useState } from 'react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateRange = (range) => {
  if (!range || !range.start) return 'Dates TBD';
  const startStr = formatDate(range.start);
  if (!range.end || formatDate(range.start) === formatDate(range.end)) {
    return startStr;
  }
  return `${startStr} – ${formatDate(range.end)}`;
};

const STATUS_BADGES = {
  Planned: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const TrainingTab = ({ trainings, loading, onEdit, onDelete, onOpenCreate, onQuickStatus }) => {
  const [activeSubTab, setActiveSubTab] = useState('Internal');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedTakeaways, setExpandedTakeaways] = useState({});

  const toggleTakeaways = (id) => {
    setExpandedTakeaways((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredTrainings = trainings.filter((t) => {
    if (t.type !== activeSubTab) return false;
    if (statusFilter !== 'All' && t.progress !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchLead = (t.facilitator || t.externalDetails?.organizers || '').toLowerCase().includes(q);
      const matchParticipants = (t.participants || []).some((p) => p.toLowerCase().includes(q));
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLead && !matchParticipants && !matchDesc) return false;
    }
    return true;
  });

  const internalCount = trainings.filter((t) => t.type === 'Internal').length;
  const externalCount = trainings.filter((t) => t.type === 'External').length;

  return (
    <div className="space-y-6">
      {/* Sub-toggle and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
          <button
            onClick={() => setActiveSubTab('Internal')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'Internal'
                ? 'bg-white text-navy-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <span>🏢</span>
            <span>Internal Upskilling</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {internalCount}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('External')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'External'
                ? 'bg-white text-navy-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <span>🌐</span>
            <span>External Bootcamps</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {externalCount}
            </span>
          </button>
        </div>

        <Button variant="primary" onClick={() => onOpenCreate(activeSubTab)}>
          <span>+</span> Log {activeSubTab === 'Internal' ? 'Internal Workshop' : 'External Course'}
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="text-slate-400 text-sm pl-1">🔍</span>
          <input
            type="text"
            placeholder={`Search ${activeSubTab.toLowerCase()} trainings by title, facilitator, or attendee...`}
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

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Status:</span>
          {['All', 'Planned', 'In Progress', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                statusFilter === st
                  ? 'bg-navy-800 text-white shadow-2xs font-semibold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm font-medium text-slate-600">Loading training logs...</p>
        </div>
      ) : filteredTrainings.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-4xl mb-3">{activeSubTab === 'Internal' ? '🏢' : '🌐'}</div>
          <h3 className="text-base font-bold text-navy-950">
            No {activeSubTab.toLowerCase()} trainings found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {search || statusFilter !== 'All'
              ? 'No trainings match your search filters. Try clearing the filter.'
              : activeSubTab === 'Internal'
              ? 'Log internal knowledge-sharing sessions, team workshops, or architecture drills.'
              : 'Record external partner vendor bootcamps, certifications prep courses, and vendor training programs.'}
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => onOpenCreate(activeSubTab)}>
              + Log First {activeSubTab} Training
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTrainings.map((item) => (
            <Card key={item._id} className="relative group hover:border-slate-300">
              <div className="space-y-3.5">
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          STATUS_BADGES[item.progress] || STATUS_BADGES.Planned
                        }`}
                      >
                        {item.progress}
                      </span>
                      {item.type === 'External' && item.externalDetails?.cost && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {item.externalDetails.cost}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                        <span>🗓️</span> {formatDateRange(item.dateRange)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-navy-900 tracking-tight leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg text-xs"
                      title="Edit Training"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs"
                      title="Delete Training"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Sub-view metadata */}
                {item.type === 'Internal' ? (
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <span className="font-semibold text-navy-900">Lead / Facilitator:</span>
                    <span className="text-slate-800 font-medium">
                      {item.facilitator || 'Self-led / Open Forum'}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Host / Vendor
                      </span>
                      <span className="text-navy-900 font-bold">
                        {item.externalDetails?.organizers || 'External Host'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Location / Modality
                      </span>
                      <span className="text-slate-800 font-medium">
                        {item.externalDetails?.country || item.externalDetails?.modality || 'Online'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Description */}
                {item.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Participants */}
                {item.participants && item.participants.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      Participants ({item.participants.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.participants.map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-navy-50 text-navy-800 border border-navy-100/80 font-medium"
                        >
                          <span>👤</span> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Institutional Takeaways / Notes */}
                {item.takeaways && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleTakeaways(item._id)}
                      className="text-[11px] font-semibold text-navy-700 hover:text-navy-900 flex items-center justify-between w-full"
                    >
                      <span>💡 Institutional Takeaways & Notes</span>
                      <span>{expandedTakeaways[item._id] ? '▲ Hide' : '▼ View'}</span>
                    </button>
                    {expandedTakeaways[item._id] && (
                      <div className="mt-2 p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-950 whitespace-pre-wrap leading-relaxed animate-fade-in">
                        {item.takeaways}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick actions footer */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Logged {formatDate(item.createdAt)}
                  </span>
                  {item.progress !== 'Completed' && (
                    <button
                      onClick={() => onQuickStatus(item._id, 'Completed')}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <span>✓</span> Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingTab;
