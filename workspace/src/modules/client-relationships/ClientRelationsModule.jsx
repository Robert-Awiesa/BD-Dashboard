import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ClientRecordView from './ClientRecordView';
import ClientFormModal from './ClientFormModal';
import LogInteractionModal from './LogInteractionModal';
import {
  CLIENT_STATUSES,
  HEALTH_BADGE,
  HEALTH_STATUSES,
  INTERACTION_ICON,
  SENTIMENT_ICON,
  SEVERITY_DOT,
  SORT_OPTIONS,
  TIERS,
  TIER_BADGE,
  formatDate,
  formatMoney,
  relativeDays,
} from './clientConstants';

const StatTile = ({ label, value, tone = 'default' }) => {
  const tones = { default: 'text-navy-950', warn: 'text-amber-800', danger: 'text-red-800' };
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-2xs">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
};

const ClientRelationsModule = () => {
  const { currentUser, clientDataVersion } = useDashboard();

  const [activeClientId, setActiveClientId] = useState(null);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [owners, setOwners] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [health, setHealth] = useState('');
  const [sort, setSort] = useState('name');

  const [formState, setFormState] = useState({ open: false, client: null });
  const [logState, setLogState] = useState({ open: false, client: null });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // `clientDataVersion` picks up interactions logged from the header Quick Log
  // while this module is on screen.
  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getClients({ search: debouncedSearch, tier, status, accountOwner: owner, health, sort }),
      bdApi.getClientStats(),
      bdApi.getInteractions({ limit: 15 }),
    ])
      .then(([list, portfolioStats, activity]) => {
        if (ignore) return;
        setClients(list);
        setStats(portfolioStats);
        setFeed(activity);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debouncedSearch, tier, status, owner, health, sort, refreshToken, clientDataVersion]);

  useEffect(() => {
    bdApi.getClientOwners().then(setOwners).catch(() => setOwners([]));
    bdApi.getClientSectors().then(setSectors).catch(() => setSectors([]));
  }, [refreshToken]);

  const filtersActive = Boolean(search || tier || status || owner || health || sort !== 'name');
  const resetFilters = () => {
    setSearch(''); setTier(''); setStatus(''); setOwner(''); setHealth(''); setSort('name');
  };

  const modals = (
    <>
      {formState.open && (
        <ClientFormModal
          open
          onClose={() => setFormState({ open: false, client: null })}
          onSaved={() => refresh()}
          currentUser={currentUser}
          existing={formState.client}
          owners={owners}
          sectors={sectors}
        />
      )}
      {logState.open && (
        <LogInteractionModal
          open
          onClose={() => setLogState({ open: false, client: null })}
          onLogged={() => refresh()}
          lockedClient={logState.client}
        />
      )}
    </>
  );

  if (activeClientId) {
    return (
      <>
        <ClientRecordView
          clientId={activeClientId}
          onBack={() => setActiveClientId(null)}
          currentUser={currentUser}
          onLogInteraction={(client) => setLogState({ open: true, client })}
          onEdit={(client) => setFormState({ open: true, client })}
          refreshToken={refreshToken + clientDataVersion}
          onChanged={refresh}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Client Relations</h1>
          <p className="text-sm text-slate-600">
            Who we look after, when we last spoke, what we promised, and how happy they are.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setLogState({ open: true, client: null })}>
            + Log interaction
          </Button>
          <Button variant="primary" onClick={() => setFormState({ open: true, client: null })}>
            + Add client
          </Button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Pick who you are in the top bar — interactions are attributed to that name.
        </div>
      )}

      {/* Portfolio health */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Active clients" value={stats.totals.active} />
          <StatTile label="Need attention" value={stats.totals.needsAttention} tone={stats.totals.needsAttention > 0 ? 'warn' : 'default'} />
          <StatTile label="Renewals ≤90d" value={stats.totals.renewalsDue} />
          <StatTile label="Overdue promises" value={stats.totals.overdueCommitments} tone={stats.totals.overdueCommitments > 0 ? 'danger' : 'default'} />
          <StatTile label="Avg satisfaction" value={stats.totals.avgSatisfaction ? `${stats.totals.avgSatisfaction}/5` : '—'} />
          <StatTile label="Portfolio value" value={formatMoney(stats.totals.portfolioValue)} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          {/* The work queue — the reason to open this page */}
          {stats?.needsAttention?.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Needs attention</h3>
              <p className="text-xs text-slate-500 mb-3">Worst first. Anyone on the team can pick these up.</p>
              <ul className="space-y-1.5">
                {stats.needsAttention.map((c) => (
                  <li key={c._id}>
                    <button
                      onClick={() => setActiveClientId(c._id)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[c.healthStatus] || 'bg-slate-400'}`} />
                          <span className="text-sm font-medium text-navy-900 truncate">{c.name}</span>
                          <Badge label={c.tier} status={TIER_BADGE[c.tier]} />
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-500">{c.accountOwner || 'unowned'}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 pl-4">
                        {c.reasons.map((r) => r.label).join(' · ')}
                        {c.reasons[0]?.detail ? ` — ${c.reasons[0].detail}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients, contacts, notes…" className="form-input sm:col-span-2"
              />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input text-sm">
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <select value={health} onChange={(e) => setHealth(e.target.value)} className="form-input text-sm">
                <option value="">Any health</option>
                {HEALTH_STATUSES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className="form-input text-sm">
                <option value="">Any tier</option>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input text-sm">
                <option value="">Any status</option>
                {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className="form-input text-sm">
                <option value="">Any owner</option>
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

          {/* Client list */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center shadow-2xs">
              <p className="text-3xl mb-2" aria-hidden="true">🤝</p>
              <h3 className="text-base font-semibold text-navy-950">
                {filtersActive ? 'No clients match those filters' : 'No clients yet'}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                {filtersActive
                  ? 'Try widening the search or clearing a filter.'
                  : 'Add the accounts you look after, then log every touch. The moment a deal is won in Pipeline, it belongs here.'}
              </p>
              {!filtersActive && (
                <div className="flex justify-center mt-4">
                  <Button variant="primary" onClick={() => setFormState({ open: true, client: null })}>+ Add your first client</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
              {clients.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setActiveClientId(c._id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-navy-900 truncate">{c.name}</span>
                      <Badge label={c.healthStatus} status={HEALTH_BADGE[c.healthStatus]} />
                      <Badge label={c.tier} status={TIER_BADGE[c.tier]} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                      {c.satisfactionScore && <span title="Latest satisfaction">★ {c.satisfactionScore}/5</span>}
                      {c.contractValue > 0 && <span>{formatMoney(c.contractValue)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                    <span>Last contact: <strong className="text-slate-700">{relativeDays(c.lastContactAt)}</strong></span>
                    <span>· every {c.expectedCadenceDays}d</span>
                    {c.accountOwner && <span>· {c.accountOwner}</span>}
                    {c.sector && <span>· {c.sector}</span>}
                    {c.renewalDate && <span>· renews {formatDate(c.renewalDate)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Team activity feed — "what did anyone learn this week?" */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900">Latest client updates</h3>
            <p className="text-xs text-slate-500 mb-3">Everything the team has logged, newest first.</p>
            {feed.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                Nothing logged yet. Use <strong>+ Quick Log</strong> in the header from anywhere in the workspace.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {feed.map((i) => (
                  <li key={i._id}>
                    <button
                      onClick={() => i.client?._id && setActiveClientId(i.client._id)}
                      className="w-full text-left flex items-start gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="shrink-0 mt-0.5" aria-hidden="true">{INTERACTION_ICON[i.type]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-navy-900 truncate">
                          {i.client?.name || 'Unknown client'}
                        </span>
                        <span className="block text-xs text-slate-600 line-clamp-2">{i.summary}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          {i.loggedBy} · {relativeDays(i.occurredAt)} {SENTIMENT_ICON[i.sentiment]}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stats?.upcomingRenewals?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-900">Renewal runway</h3>
              <p className="text-xs text-slate-500 mb-3">Revenue up for decision in the next 90 days.</p>
              <ul className="space-y-1.5">
                {stats.upcomingRenewals.map((r) => (
                  <li key={r._id}>
                    <button
                      onClick={() => setActiveClientId(r._id)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-navy-900 truncate">{r.name}</span>
                        <span className="block text-[11px] text-slate-500">{r.accountOwner || 'unowned'}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-[11px] font-medium ${r.daysToRenewal <= 30 ? 'text-red-700' : 'text-slate-600'}`}>
                          {r.daysToRenewal}d
                        </span>
                        <span className="block text-[11px] text-slate-400">{formatMoney(r.contractValue)}</span>
                      </span>
                    </button>
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

export default ClientRelationsModule;
