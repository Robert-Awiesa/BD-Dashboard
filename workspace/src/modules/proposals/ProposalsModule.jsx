import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/useDashboard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ProposalFormModal from './ProposalFormModal';
import ProposalDetailModal from './ProposalDetailModal';
import {
  ORIGINS,
  ORIGIN_ICON,
  SEVERITY_DOT,
  SORT_OPTIONS,
  STAGES,
  STAGE_BADGE,
  deadlineLabel,
  formatMoney,
} from './proposalConstants';

const StatTile = ({ label, value, tone = 'default', hint }) => {
  const tones = { default: 'text-navy-900', warn: 'text-amber-700', danger: 'text-red-700', good: 'text-forest-700' };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-slate-400 leading-tight">{hint}</p>}
    </div>
  );
};

const ProposalRow = ({ proposal, onOpen }) => {
  const who = proposal.client?.name || proposal.prospectName;
  const overdue = proposal.daysToDeadline !== null && proposal.daysToDeadline < 0;

  return (
    <button
      onClick={() => onOpen(proposal)}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true">{ORIGIN_ICON[proposal.origin] || '📝'}</span>
          <span className="text-sm font-semibold text-navy-900 truncate">{proposal.title}</span>
          <Badge label={proposal.stage} status={STAGE_BADGE[proposal.stage]} />
          {proposal.isCold && <Badge label="Cold" status="danger" />}
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          {proposal.daysToDeadline !== null && (
            <span className={overdue ? 'text-red-700 font-medium' : 'text-slate-500'}>
              {deadlineLabel(proposal.daysToDeadline)}
            </span>
          )}
          <span className="text-navy-900 font-semibold">{formatMoney(proposal.value)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
        <span className="text-slate-700 font-medium">{who}</span>
        {proposal.sector && <span>· {proposal.sector}</span>}
        {proposal.owner && <span>· {proposal.owner}</span>}
        {proposal.openChecklistItems > 0 && <span>· {proposal.openChecklistItems} open item(s)</span>}
        {proposal.lossReason && <span className="text-red-700">· lost: {proposal.lossReason}</span>}
      </div>
    </button>
  );
};

const ProposalsModule = () => {
  const { currentUser, clientDataVersion } = useDashboard();

  const [proposals, setProposals] = useState([]);
  const [stats, setStats] = useState(null);
  const [owners, setOwners] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stage, setStage] = useState('');
  const [origin, setOrigin] = useState('');
  const [owner, setOwner] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [sort, setSort] = useState('deadline');

  const [formState, setFormState] = useState({ open: false, proposal: null });
  const [detail, setDetail] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getProposals({ search: debouncedSearch, stage, origin, owner, sort, open: openOnly ? 'true' : '' }),
      bdApi.getProposalStats(),
      bdApi.getProposalOwners(),
      bdApi.getProposalSectors(),
    ])
      .then(([list, s, o, sec]) => {
        if (ignore) return;
        setProposals(list);
        setStats(s);
        setOwners(o);
        setSectors(sec);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debouncedSearch, stage, origin, owner, sort, openOnly, refreshToken, clientDataVersion]);

  const openDetail = async (proposal) => {
    try {
      setDetail(await bdApi.getProposal(proposal._id));
    } catch {
      setDetail(proposal);
    }
  };

  const handleDelete = async (proposal) => {
    try {
      await bdApi.deleteProposal(proposal._id);
      setDetail(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtersActive = Boolean(search || stage || origin || owner || !openOnly || sort !== 'deadline');
  const resetFilters = () => {
    setSearch(''); setStage(''); setOrigin(''); setOwner(''); setOpenOnly(true); setSort('deadline');
  };

  const modals = (
    <>
      {formState.open && (
        <ProposalFormModal
          open
          onClose={() => setFormState({ open: false, proposal: null })}
          onSaved={refresh}
          currentUser={currentUser}
          existing={formState.proposal}
          owners={owners}
          sectors={sectors}
        />
      )}
      {detail && (
        <ProposalDetailModal
          key={detail._id}
          open
          onClose={() => setDetail(null)}
          proposal={detail}
          onChanged={(updated) => { setDetail(updated); refresh(); }}
          onEdit={(p) => { setDetail(null); setFormState({ open: true, proposal: p }); }}
          onDelete={handleDelete}
        />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Proposals</h1>
          <p className="text-sm text-slate-600">
            Requested RFPs and unsolicited pitches — what is out, what is going quiet, and why we win or lose.
          </p>
        </div>
        <Button variant="primary" onClick={() => setFormState({ open: true, proposal: null })}>
          + New proposal
        </Button>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Pick who you are in the top bar — new proposals default to that bid lead.
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Open bids" value={stats.totals.open} hint={formatMoney(stats.totals.openValue)} />
          <StatTile
            label="Weighted forecast" value={formatMoney(stats.totals.weightedForecast)}
            hint="value × stage probability"
          />
          <StatTile
            label="Win rate" value={stats.totals.winRateByCount !== null ? `${stats.totals.winRateByCount}%` : '—'}
            tone="good"
            hint={stats.totals.winRateByValue !== null ? `${stats.totals.winRateByValue}% by value` : 'no decisions yet'}
          />
          <StatTile
            label="Due this week" value={stats.totals.dueThisWeek}
            tone={stats.totals.dueThisWeek > 0 ? 'warn' : 'default'}
          />
          <StatTile
            label="Gone cold" value={stats.totals.cold}
            tone={stats.totals.cold > 0 ? 'danger' : 'default'}
          />
          <StatTile
            label="Avg days to decision"
            value={stats.totals.avgDaysToDecision !== null ? stats.totals.avgDaysToDecision : '—'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          {stats?.needsAttention?.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Needs attention</h3>
              <p className="text-xs text-slate-500 mb-3">Worst first — deadlines, silence and overdue decisions.</p>
              <ul className="space-y-1.5">
                {stats.needsAttention.map((p) => (
                  <li key={p._id}>
                    <button
                      onClick={() => openDetail(p)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[p.worst] || 'bg-slate-400'}`} />
                          <span className="text-sm font-medium text-navy-900 truncate">{p.title}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {formatMoney(p.value)} · {p.owner || 'unowned'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 pl-4">
                        {p.reasons.map((r) => r.label).join(' · ')}
                        {p.reasons[0]?.detail ? ` — ${p.reasons[0].detail}` : ''}
                      </p>
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
                placeholder="Search title, client, sector, competitor…" className="form-input sm:col-span-2"
              />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input text-sm">
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap px-1">
                <input
                  type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)}
                  className="accent-navy-700 cursor-pointer"
                />
                Open bids only
              </label>

              <select value={stage} onChange={(e) => setStage(e.target.value)} className="form-input text-sm">
                <option value="">Any stage</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="form-input text-sm">
                <option value="">Any origin</option>
                {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className="form-input text-sm">
                <option value="">Any bid lead</option>
                {owners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="flex items-center">
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
          ) : proposals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-3xl mb-2" aria-hidden="true">📝</p>
              <h3 className="text-base font-semibold text-navy-900">
                {filtersActive ? 'No proposals match those filters' : 'No proposals yet'}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                {filtersActive
                  ? 'Try widening the search or clearing a filter.'
                  : 'Track every bid from drafting through to the decision — including why it was won or lost.'}
              </p>
              {!filtersActive && (
                <div className="flex justify-center mt-4">
                  <Button variant="primary" onClick={() => setFormState({ open: true, proposal: null })}>
                    + Create the first proposal
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
              {proposals.map((p) => <ProposalRow key={p._id} proposal={p} onOpen={openDetail} />)}
            </div>
          )}
        </div>

        {/* Win/loss intelligence — the reason to keep the record honest */}
        <div className="xl:col-span-1 space-y-4">
          {stats?.upcomingDeadlines?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Submission runway</h3>
              <p className="text-xs text-slate-500 mb-3">What has to go out, soonest first.</p>
              <ul className="space-y-1.5">
                {stats.upcomingDeadlines.map((d) => (
                  <li key={d._id}>
                    <button
                      onClick={() => openDetail(d)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">{d.title}</span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {d.who}{d.openChecklistItems ? ` · ${d.openChecklistItems} open` : ''}
                        </span>
                      </span>
                      <span className={`shrink-0 text-[11px] font-medium ${d.daysToDeadline <= 3 ? 'text-red-700' : 'text-slate-600'}`}>
                        {d.daysToDeadline}d
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900">Why we lose</h3>
            <p className="text-xs text-slate-500 mb-3">
              The pattern only appears if every loss carries a reason.
            </p>
            {!stats?.lossReasons?.length ? (
              <p className="text-xs text-slate-400 py-1">No losses recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.lossReasons.map((l) => {
                  const max = stats.lossReasons[0].count || 1;
                  return (
                    <li key={l.reason}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-navy-900 truncate">{l.reason}</span>
                        <span className="text-slate-500 shrink-0">
                          {l.count} · {formatMoney(l.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(l.count / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {stats?.bySector?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Win rate by sector</h3>
              <p className="text-xs text-slate-500 mb-3">Where we are strong, and where we are not.</p>
              <ul className="space-y-1.5">
                {stats.bySector.map((s) => {
                  const rate = s.total ? Math.round((s.won / s.total) * 100) : 0;
                  return (
                    <li key={s.sector} className="flex items-center justify-between gap-2 px-1">
                      <span className="text-xs text-navy-900 truncate">{s.sector}</span>
                      <span className={`text-xs font-medium ${rate >= 50 ? 'text-forest-700' : 'text-slate-500'}`}>
                        {rate}% <span className="text-slate-400 font-normal">({s.won}/{s.total})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {stats && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Pipeline by stage</h3>
              <ul className="space-y-1 mt-2">
                {STAGES.filter((s) => stats.byStage[s]?.count > 0).map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2 px-1">
                    <span className="text-xs text-slate-700 truncate">{s}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {stats.byStage[s].count} · {formatMoney(stats.byStage[s].value)}
                    </span>
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

export default ProposalsModule;
