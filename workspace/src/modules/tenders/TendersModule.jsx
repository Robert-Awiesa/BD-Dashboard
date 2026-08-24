import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import TenderFormModal from './TenderFormModal';
import TenderDetailModal from './TenderDetailModal';
import { EoiFormModal, EoiDetailModal } from './EOIModals';
import {
  DEADLINE_BADGE,
  DECISION_BADGE,
  EOI_STATUSES,
  EOI_VIEWS,
  SORT_OPTIONS,
  SOURCES,
  SOURCE_LABEL,
  STATUS_BADGE,
  TENDER_STATUSES,
  TENDER_VIEWS,
  deadlineLabel,
  formatDate,
  formatMoney,
} from './tenderConstants';

const TABS = [
  { key: 'tenders', label: 'Tenders' },
  { key: 'eois', label: 'Expressions of Interest' },
];

const StatTile = ({ label, value, tone = 'default', hint }) => {
  const tones = {
    default: 'text-navy-900',
    warn: 'text-amber-700',
    danger: 'text-red-700',
    good: 'text-forest-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{hint}</p>}
    </div>
  );
};

// A deadline is the only thing on this row that changes on its own, so it gets
// the emphasis — colour comes from the computed status, never from typed text.
const DeadlineCell = ({ days, status }) => (
  <span className="shrink-0 text-right">
    <Badge label={status} status={DEADLINE_BADGE[status] || 'default'} />
    <span className={`block text-[11px] mt-0.5 ${days !== null && days < 0 ? 'text-red-700 font-medium' : 'text-slate-500'}`}>
      {deadlineLabel(days)}
    </span>
  </span>
);

// "Started" means somebody has put something in it, not that it is finished.
const hasPdp = (t) =>
  Boolean(t.pdp?.objectives?.trim() || t.pdp?.proposedSolution?.trim() || t.pdp?.notes?.trim()
    || t.pdp?.milestones?.length || t.pdp?.individuals?.length);

const hasFdp = (t) =>
  Boolean(t.fdp && Object.entries(t.fdp).some(([k, v]) =>
    k !== '_id' && v !== '' && v !== null && v !== undefined && v !== 0));

const PlanChip = ({ label, started }) => (
  <span
    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${
      started
        ? 'bg-forest-50 text-forest-700 border-forest-200'
        : 'bg-slate-50 text-slate-400 border-slate-200'
    }`}
    title={started ? `${label} started` : `${label} not started yet`}
  >
    {label}
  </span>
);

const TenderRow = ({ tender, onOpen }) => (
  <button
    onClick={() => onOpen(tender)}
    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-navy-900 truncate">{tender.title}</span>
          <Badge label={tender.status} status={STATUS_BADGE[tender.status]} />
          {tender.isMissed && <Badge label="Missed" status="danger" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
          {tender.issuingAuthority && <span>{tender.issuingAuthority}</span>}
          {tender.reference && <span>· {tender.reference}</span>}
          <span>· {tender.tenderType}</span>
          {tender.owner && <span>· {tender.owner}</span>}
          {tender.estimatedValue > 0 && <span>· {formatMoney(tender.estimatedValue, tender.currency)}</span>}
        </div>
        {/* The two plans always show, whether or not they have been started —
            a registry-only tender should make it obvious what is still to do. */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <PlanChip label="PDP" started={hasPdp(tender)} />
          <PlanChip label="FDP" started={hasFdp(tender)} />
          {tender.pdp?.milestones?.length > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-32 max-w-xs">
              <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-forest-500 rounded-full" style={{ width: `${tender.pdpProgress}%` }} />
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{tender.pdpProgress}% prepared</span>
            </div>
          )}
        </div>
      </div>
      <DeadlineCell days={tender.daysToDeadline} status={tender.deadlineStatus} />
    </div>
  </button>
);

const EoiRow = ({ eoi, onOpen }) => (
  <button
    onClick={() => onOpen(eoi)}
    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-navy-900 truncate">{eoi.title}</span>
          <Badge label={eoi.decision} status={DECISION_BADGE[eoi.decision]} />
          {eoi.convertedToTender && <Badge label="Became a tender" status="success" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
          {eoi.issuingAuthority && <span>{eoi.issuingAuthority}</span>}
          <span>· {SOURCE_LABEL(eoi.source, eoi.sourceDetail)}</span>
          {eoi.owner && <span>· {eoi.owner}</span>}
          {eoi.attachmentUrl && <span>· 📎 attached</span>}
        </div>
        {eoi.decision === 'Pass' && eoi.decisionReason && (
          <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">Passed: {eoi.decisionReason}</p>
        )}
      </div>
      <DeadlineCell days={eoi.daysToDeadline} status={eoi.deadlineStatus} />
    </div>
  </button>
);

const TendersModule = () => {
  const [tab, setTab] = useState('tenders');
  const [tenders, setTenders] = useState([]);
  const [eois, setEois] = useState([]);
  const [stats, setStats] = useState(null);
  const [owners, setOwners] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [runwayDays, setRunwayDays] = useState(60);
  const [runway, setRunway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [owner, setOwner] = useState('');
  const [sort, setSort] = useState('deadline');

  const [tenderForm, setTenderForm] = useState({ open: false, existing: null });
  const [tenderDetail, setTenderDetail] = useState(null);
  const [eoiForm, setEoiForm] = useState({ open: false, existing: null });
  const [eoiDetail, setEoiDetail] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((t) => t + 1);

  // Switching tabs changes which filters are meaningful, so clear them here
  // rather than syncing through an effect — a tender status carried over to
  // the EOI list would silently match nothing.
  const changeTab = (key) => {
    setTab(key);
    setView('');
    setStatus('');
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    if (runwayDays === 60) return undefined;
    bdApi.getDeadlineRunway(runwayDays)
      .then((rows) => { if (!ignore) setRunway(rows); })
      .catch((err) => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, [runwayDays, refreshToken]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getTenders({ search: debouncedSearch, view, status, source, owner, sort }),
      bdApi.getEois({ search: debouncedSearch, view, status, source, owner }),
      bdApi.getTenderStats(),
      bdApi.getTenderOwners(),
      bdApi.getIssuingAuthorities(),
    ])
      .then(([t, e, s, o, a]) => {
        if (ignore) return;
        setTenders(t);
        setEois(e);
        setStats(s);
        setOwners(o);
        setAuthorities(a);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debouncedSearch, view, status, source, owner, sort, refreshToken]);

  const openTenderDetail = async (t) => {
    try { setTenderDetail(await bdApi.getTender(t._id)); }
    catch { setTenderDetail(t); }
  };

  const openEoiDetail = async (e) => {
    try { setEoiDetail(await bdApi.getEoi(e._id)); }
    catch { setEoiDetail(e); }
  };

  const handleDeleteTender = async (t) => {
    try {
      await bdApi.deleteTender(t._id);
      setTenderDetail(null);
      refresh();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteEoi = async (e) => {
    try {
      await bdApi.deleteEoi(e._id);
      setEoiDetail(null);
      refresh();
    } catch (err) { setError(err.message); }
  };

  const views = tab === 'tenders' ? TENDER_VIEWS : EOI_VIEWS;
  const statuses = tab === 'tenders' ? TENDER_STATUSES : EOI_STATUSES;
  const filtersActive = Boolean(search || view || status || source || owner || sort !== 'deadline');
  const resetFilters = () => {
    setSearch(''); setView(''); setStatus(''); setSource(''); setOwner(''); setSort('deadline');
  };

  // The stats call already carries the default 60-day runway, so only a
  // non-default window costs an extra request.
  const runwayRows = runway ?? stats?.runway ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Tenders &amp; EOI</h1>
          <p className="text-sm text-slate-600">
            Opportunities with hard deadlines — what is closing, who owns it, and what we decided.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEoiForm({ open: true, existing: null })}>
            + Log an EOI
          </Button>
          <Button variant="primary" onClick={() => setTenderForm({ open: true, existing: null })}>
            + New tender
          </Button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Live tenders" value={stats.totals.open} />
          <StatTile
            label="Closing within 7 days" value={stats.totals.closingSoon}
            tone={stats.totals.closingSoon > 0 ? 'warn' : 'default'}
          />
          <StatTile
            label="Missed" value={stats.totals.missed}
            tone={stats.totals.missed > 0 ? 'danger' : 'default'}
            hint={stats.totals.missed > 0 ? 'deadline passed, still open' : undefined}
          />
          <StatTile
            label="EOIs awaiting a call" value={stats.totals.eoisAwaitingDecision}
            tone={stats.totals.eoisAwaitingDecision > 0 ? 'warn' : 'default'}
          />
          <StatTile label="Pipeline value" value={formatMoney(stats.totals.pipelineValue)} />
          <StatTile
            label="Win rate"
            value={stats.totals.winRate === null ? '—' : `${stats.totals.winRate}%`}
            tone={stats.totals.winRate !== null && stats.totals.winRate >= 50 ? 'good' : 'default'}
            hint={`${stats.totals.won}W / ${stats.totals.lost}L`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          {/* Filter bar. Grid rather than flex: `.form-input` forces width:100%
              on real controls with higher specificity than any width utility. */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                    view === v.id
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, reference, authority…" className="form-input sm:col-span-2"
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input text-sm">
                <option value="">Any status</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="form-input text-sm">
                <option value="">Any source</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className="form-input text-sm">
                <option value="">Any owner</option>
                {owners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {tab === 'tenders' && (
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input text-sm">
                  {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
              <div className="flex items-center">
                {filtersActive && (
                  <button onClick={resetFilters} className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-700 cursor-pointer">
                    ✕ Reset filters
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
                  tab === t.key ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">
                  {t.key === 'tenders' ? tenders.length : eois.length}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          ) : tab === 'tenders' ? (
            tenders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <p className="text-3xl mb-2" aria-hidden="true">📑</p>
                <h3 className="text-base font-semibold text-navy-900">
                  {filtersActive ? 'No tenders match those filters' : 'No tenders yet'}
                </h3>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  {filtersActive
                    ? 'Try widening the search or clearing a filter.'
                    : 'Track an opportunity with a real deadline, and it will start warning you as the date approaches.'}
                </p>
                {!filtersActive && (
                  <div className="flex justify-center mt-4">
                    <Button variant="primary" onClick={() => setTenderForm({ open: true, existing: null })}>
                      + Create the first tender
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
                {tenders.map((t) => <TenderRow key={t._id} tender={t} onOpen={openTenderDetail} />)}
              </div>
            )
          ) : eois.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-3xl mb-2" aria-hidden="true">📨</p>
              <h3 className="text-base font-semibold text-navy-900">
                {filtersActive ? 'No EOIs match those filters' : 'No expressions of interest yet'}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                {filtersActive
                  ? 'Try widening the search or clearing a filter.'
                  : 'Capture an early signal with its clipping, screenshot, link or note — then record whether we pursue it.'}
              </p>
              {!filtersActive && (
                <div className="flex justify-center mt-4">
                  <Button variant="primary" onClick={() => setEoiForm({ open: true, existing: null })}>
                    + Create the first EOI
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
              {eois.map((e) => <EoiRow key={e._id} eoi={e} onOpen={openEoiDetail} />)}
            </div>
          )}
        </div>

        {/* The operational question this module exists to answer: what is
            closing, and when? One list across both tabs, because a deadline
            does not care which tab it lives on. */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy-900">Deadline runway</h3>
              <select
                aria-label="Runway window"
                value={runwayDays}
                onChange={(e) => { setRunway(null); setRunwayDays(Number(e.target.value)); }}
                className="form-input text-xs py-1"
              >
                {[30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Tenders and EOIs together, next {runwayDays} days.
            </p>
            {!runwayRows.length ? (
              <p className="text-xs text-slate-400 py-2">Nothing closing in the next {runwayDays} days.</p>
            ) : (
              <ul className="space-y-1.5">
                {runwayRows.map((r) => (
                  <li key={`${r.kind}-${r._id}`}>
                    <button
                      onClick={() => (r.kind === 'Tender' ? openTenderDetail(r) : openEoiDetail(r))}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">{r.title}</span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {r.kind} · {r.issuingAuthority || 'no authority'} · {r.owner || 'unowned'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-[11px] font-medium ${r.daysToDeadline < 0 ? 'text-red-700' : r.daysToDeadline <= 7 ? 'text-amber-700' : 'text-slate-600'}`}>
                          {deadlineLabel(r.daysToDeadline)}
                        </span>
                        <span className="block text-[10px] text-slate-400">{formatDate(r.deadline)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stats?.missed?.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-red-800">Missed deadlines</h3>
              <p className="text-xs text-slate-500 mb-3">
                Passed while still open. Submit late if it is allowed, or close them out as No Bid.
              </p>
              <ul className="space-y-1.5">
                {stats.missed.map((m) => (
                  <li key={m._id}>
                    <button
                      onClick={() => openTenderDetail(m)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">{m.title}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{m.owner || 'unowned'}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-red-700">{deadlineLabel(m.daysToDeadline)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats && (stats.totals.eoisPursued > 0 || stats.totals.eoisPassed > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Bid / no-bid record</h3>
              <p className="text-xs text-slate-500 mb-3">
                What we chose to chase. A high pass rate is fine — an unexamined one is not.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-forest-700">{stats.totals.eoisPursued}</p>
                  <p className="text-[11px] text-slate-500">Pursued</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-500">{stats.totals.eoisPassed}</p>
                  <p className="text-[11px] text-slate-500">Passed</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-700">{stats.totals.eoisAwaitingDecision}</p>
                  <p className="text-[11px] text-slate-500">Undecided</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tender modals */}
      {tenderForm.open && (
        <TenderFormModal
          open
          onClose={() => setTenderForm({ open: false, existing: null })}
          onSaved={(saved) => { setTenderForm({ open: false, existing: null }); setTenderDetail(saved); refresh(); }}
          existing={tenderForm.existing}
          owners={owners}
          authorities={authorities}
        />
      )}
      {tenderDetail && (
        <TenderDetailModal
          key={tenderDetail._id}
          open
          onClose={() => setTenderDetail(null)}
          tender={tenderDetail}
          onEdit={(t) => { setTenderDetail(null); setTenderForm({ open: true, existing: t }); }}
          onDelete={handleDeleteTender}
          onChanged={(updated) => { setTenderDetail(updated); refresh(); }}
        />
      )}

      {/* EOI modals */}
      {eoiForm.open && (
        <EoiFormModal
          open
          onClose={() => setEoiForm({ open: false, existing: null })}
          onSaved={(saved) => { setEoiForm({ open: false, existing: null }); setEoiDetail(saved); refresh(); }}
          existing={eoiForm.existing}
          owners={owners}
          authorities={authorities}
        />
      )}
      {eoiDetail && (
        <EoiDetailModal
          key={eoiDetail._id}
          open
          onClose={() => setEoiDetail(null)}
          eoi={eoiDetail}
          onEdit={(e) => { setEoiDetail(null); setEoiForm({ open: true, existing: e }); }}
          onDelete={handleDeleteEoi}
          onChanged={(updated) => { setEoiDetail(updated); refresh(); }}
          onConverted={(tender) => { setEoiDetail(null); refresh(); setTenderDetail(tender); setTab('tenders'); }}
        />
      )}
    </div>
  );
};

export default TendersModule;
