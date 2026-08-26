import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import VisitFormModal from './VisitFormModal';
import VisitDetailModal from './VisitDetailModal';
import {
  SENTIMENT_ICON,
  STATUS_BADGE,
  VISIT_STATUSES,
  formatDate,
  formatDuration,
  relativeDays,
} from './fieldVisitConstants';

const StatTile = ({ label, value, tone = 'default' }) => {
  const tones = { default: 'text-navy-900', warn: 'text-amber-700', danger: 'text-red-700' };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
};

const VisitRow = ({ visit, onOpen }) => (
  <button
    onClick={() => onOpen(visit)}
    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden="true">📍</span>
        <span className="text-sm font-semibold text-navy-900 truncate">{visit.locationName}</span>
        <Badge label={visit.visitStatus} status={STATUS_BADGE[visit.visitStatus]} />
        {visit.awaitingReport && <Badge label="No write-up" status="danger" />}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
        {visit.photos?.length > 0 && <span title="Photos">📷 {visit.photos.length}</span>}
        {visit.durationMinutes > 0 && <span>{formatDuration(visit.durationMinutes)}</span>}
        {visit.visitStatus === 'Completed' && <span>{SENTIMENT_ICON[visit.sentiment]}</span>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
      <span className="text-slate-700 font-medium">{visit.client?.name || 'Unknown client'}</span>
      <span>· {formatDate(visit.occurredAt)}</span>
      {visit.visitStatus === 'Planned' && <span>· {relativeDays(visit.occurredAt)}</span>}
      <span>· {visit.loggedBy}</span>
      {visit.clientAttendees?.length > 0 && <span>· met {visit.clientAttendees.join(', ')}</span>}
    </div>
    {(visit.observations || visit.purpose) && (
      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{visit.observations || visit.purpose}</p>
    )}
  </button>
);

const FieldVisitsModule = () => {
  const { currentUser, clientDataVersion } = useDashboard();

  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [client, setClient] = useState('');
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const [clients, setClients] = useState([]);

  const [formState, setFormState] = useState({ open: false, mode: 'log', visit: null });
  const [detailVisit, setDetailVisit] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getFieldVisits({
        search: debouncedSearch,
        status,
        client,
        awaitingReport: awaitingOnly ? 'true' : '',
      }),
      bdApi.getFieldVisitStats(),
    ])
      .then(([list, s]) => {
        if (ignore) return;
        setVisits(list);
        setStats(s);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debouncedSearch, status, client, awaitingOnly, refreshToken, clientDataVersion]);

  useEffect(() => {
    bdApi.getClients({ sort: 'name' }).then(setClients).catch(() => setClients([]));
  }, [refreshToken]);

  const openDetail = async (visit) => {
    try {
      setDetailVisit(await bdApi.getFieldVisit(visit._id));
    } catch {
      setDetailVisit(visit);
    }
  };

  const handleDelete = async (visit) => {
    try {
      await bdApi.deleteFieldVisit(visit._id);
      setDetailVisit(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtersActive = Boolean(search || status || client || awaitingOnly);
  const resetFilters = () => { setSearch(''); setStatus(''); setClient(''); setAwaitingOnly(false); };

  const modals = (
    <>
      {formState.open && (
        <VisitFormModal
          open
          onClose={() => setFormState({ open: false, mode: 'log', visit: null })}
          onSaved={refresh}
          existing={formState.visit}
          mode={formState.mode}
        />
      )}
      {detailVisit && (
        <VisitDetailModal
          key={detailVisit._id}
          open
          onClose={() => setDetailVisit(null)}
          visit={detailVisit}
          onChanged={(updated) => { setDetailVisit(updated); refresh(); }}
          onEdit={(v) => { setDetailVisit(null); setFormState({ open: true, mode: 'log', visit: v }); }}
          onDelete={handleDelete}
        />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Field Visits</h1>
          <p className="text-sm text-slate-600">
            On-site client interactions — where the team went, who they saw, and what came out of it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFormState({ open: true, mode: 'plan', visit: null })}>
            🗓 Plan a visit
          </Button>
          <Button variant="primary" onClick={() => setFormState({ open: true, mode: 'log', visit: null })}>
            + Log a visit
          </Button>
          <Button variant="primary"  onClick={() => setFormState({ open: true, mode: 'log', visit: null })}>
            + Log a Discovery
          </Button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Pick who you are in the top bar — visits are attributed to that name.
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Visits this month" value={stats.totals.thisMonth} />
          <StatTile label="Planned ahead" value={stats.totals.planned} />
          <StatTile
            label="Awaiting write-up" value={stats.totals.awaitingReport}
            tone={stats.totals.awaitingReport > 0 ? 'danger' : 'default'}
          />
          <StatTile
            label="Past their date" value={stats.totals.overduePlanned}
            tone={stats.totals.overduePlanned > 0 ? 'warn' : 'default'}
          />
          <StatTile
            label="Clients seen (90d)"
            value={`${stats.totals.clientsVisited90d}/${stats.totals.activeClients}`}
          />
          <StatTile label="Photos captured" value={stats.totals.photos} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          {/* The write-up backlog: trips already paid for whose value is stuck
              in someone's head. Highest-value queue on the page. */}
          {stats?.awaitingReport?.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-red-800">Visits with no write-up</h3>
              <p className="text-xs text-slate-500 mb-3">
                The trip happened; the knowledge has not landed yet.
              </p>
              <ul className="space-y-1">
                {stats.awaitingReport.map((v) => (
                  <li key={v._id}>
                    <button
                      onClick={() => openDetail(v)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">
                          {v.client?.name} — {v.locationName}
                        </span>
                        <span className="block text-[11px] text-slate-500">{v.loggedBy}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-red-700">{relativeDays(v.occurredAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search site, findings, who we met…" className="form-input sm:col-span-2"
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input text-sm">
                <option value="">Any status</option>
                {VISIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={client} onChange={(e) => setClient(e.target.value)} className="form-input text-sm">
                <option value="">Any client</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap px-1 sm:col-span-2">
                <input
                  type="checkbox" checked={awaitingOnly}
                  onChange={(e) => setAwaitingOnly(e.target.checked)}
                  className="accent-navy-700 cursor-pointer"
                />
                Only visits awaiting a write-up
              </label>
              <div className="flex items-center sm:col-span-2 justify-end">
                {filtersActive && (
                  <button onClick={resetFilters} className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-700 cursor-pointer">
                    ✕ Reset filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          ) : visits.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-3xl mb-2" aria-hidden="true">📍</p>
              <h3 className="text-base font-semibold text-navy-900">
                {filtersActive ? 'No visits match those filters' : 'No site visits recorded yet'}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                {filtersActive
                  ? 'Try widening the search or clearing a filter.'
                  : 'Log a trip after it happens, or book one ahead. Either way it lands on the client’s timeline.'}
              </p>
              {!filtersActive && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="secondary" onClick={() => setFormState({ open: true, mode: 'plan', visit: null })}>
                    🗓 Plan a visit
                  </Button>
                  <Button variant="primary" onClick={() => setFormState({ open: true, mode: 'log', visit: null })}>
                    + Log a visit
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
              {visits.map((v) => <VisitRow key={v._id} visit={v} onOpen={openDetail} />)}
            </div>
          )}
        </div>

        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900">Coming up</h3>
            <p className="text-xs text-slate-500 mb-3">Booked trips, soonest first.</p>
            {!stats?.upcoming?.length ? (
              <p className="text-xs text-slate-400 py-2">Nothing booked. Planning ahead beats remembering after.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.upcoming.map((v) => (
                  <li key={v._id}>
                    <button
                      onClick={() => openDetail(v)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">{v.locationName}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{v.client?.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-navy-700">{relativeDays(v.occurredAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stats?.overduePlanned?.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-amber-800">Planned date has passed</h3>
              <p className="text-xs text-slate-500 mb-3">Complete these or cancel them.</p>
              <ul className="space-y-1.5">
                {stats.overduePlanned.map((v) => (
                  <li key={v._id}>
                    <button
                      onClick={() => openDetail(v)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="text-xs font-medium text-navy-900 truncate min-w-0">
                        {v.client?.name} — {v.locationName}
                      </span>
                      <span className="shrink-0 text-[11px] text-amber-700">{relativeDays(v.occurredAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats?.byPerson?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Who was out this month</h3>
              <ul className="space-y-1.5 mt-2">
                {stats.byPerson.map((p) => (
                  <li key={p.person} className="flex items-center justify-between gap-2 px-2 py-1">
                    <span className="text-xs text-navy-900 truncate">{p.person}</span>
                    <span className="text-xs text-slate-500">{p.count} visit{p.count === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {modals}
    </div>
  );
};

export default FieldVisitsModule;
