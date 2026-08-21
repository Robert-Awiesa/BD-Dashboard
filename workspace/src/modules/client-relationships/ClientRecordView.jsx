import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  HEALTH_BADGE,
  INTERACTION_ICON,
  SENTIMENT_ICON,
  SEVERITY_DOT,
  TIER_BADGE,
  formatDate,
  formatMoney,
  relativeDays,
} from './clientConstants';
import ClientAppreciation from './ClientAppreciation';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'satisfaction', label: 'Satisfaction' },
];

const Stat = ({ label, value, tone = 'default' }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
    <p className={`text-lg font-bold ${tone === 'warn' ? 'text-red-700' : 'text-navy-900'}`}>{value}</p>
    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
  </div>
);

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const ClientRecordView = ({ clientId, onBack, currentUser, onLogInteraction, onEdit, refreshToken, onChanged }) => {
  const [client, setClient] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const [commitmentDraft, setCommitmentDraft] = useState({ description: '', dueDate: '' });
  const [surveyDraft, setSurveyDraft] = useState({ score: 5, comment: '', respondent: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([bdApi.getClient(clientId), bdApi.getInteractions({ client: clientId, limit: 200 })])
      .then(([c, list]) => {
        if (ignore) return;
        setClient(c);
        setInteractions(list);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [clientId, refreshToken]);

  const apply = (updated) => {
    setClient(updated);
    onChanged?.();
  };

  const addCommitment = async (e) => {
    e.preventDefault();
    if (!commitmentDraft.description.trim()) return;
    try {
      apply(await bdApi.addCommitment(clientId, { ...commitmentDraft, createdBy: currentUser, owner: currentUser }));
      setCommitmentDraft({ description: '', dueDate: '' });
    } catch (err) { setError(err.message); }
  };

  const toggleCommitment = async (id, completed) => {
    try { apply(await bdApi.setCommitmentDone(clientId, id, completed)); }
    catch (err) { setError(err.message); }
  };

  const removeCommitment = async (id) => {
    try { apply(await bdApi.deleteCommitment(clientId, id)); }
    catch (err) { setError(err.message); }
  };

  // A survey score logged against the wrong client skews the health trend until
  // somebody can take it back out.
  const removeSurvey = async (id) => {
    if (!window.confirm('Remove this survey score?')) return;
    try { apply(await bdApi.deleteClientSurvey(clientId, id)); }
    catch (err) { setError(err.message); }
  };

  // Interactions drive the contact-cadence health rule, so a mistyped one has
  // to be removable or the account reads as healthier than it is.
  const removeInteraction = async (id) => {
    if (!window.confirm('Delete this interaction?')) return;
    try {
      await bdApi.deleteInteraction(id);
      setInteractions((prev) => prev.filter((i) => i._id !== id));
      onChanged?.();
    } catch (err) { setError(err.message); }
  };

  const recordSurvey = async (e) => {
    e.preventDefault();
    try {
      apply(await bdApi.recordClientSurvey(clientId, { ...surveyDraft, collectedBy: currentUser }));
      setSurveyDraft({ score: 5, comment: '', respondent: '' });
    } catch (err) { setError(err.message); }
  };

  const toggleArchive = async () => {
    try {
      await bdApi.setClientArchived(clientId, !client.archived);
      apply(await bdApi.getClient(clientId));
      setConfirmDelete(false);
    } catch (err) { setError(err.message); }
  };

  const hardDelete = async () => {
    try {
      await bdApi.deleteClient(clientId);
      onChanged?.();
      onBack();
    } catch (err) { setError(err.message); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs font-medium text-slate-500 hover:text-navy-800 cursor-pointer">
          ← All clients
        </button>
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error || 'Client not found.'}
        </div>
      </div>
    );
  }

  const openCommitments = (client.commitments || []).filter((c) => !c.completed);
  const doneCommitments = (client.commitments || []).filter((c) => c.completed);
  const surveys = [...(client.surveys || [])].sort(
    (a, b) => new Date(b.collectedAt) - new Date(a.collectedAt)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onBack} className="text-xs font-medium text-slate-500 hover:text-navy-800 cursor-pointer mb-1">
            ← All clients
          </button>
          <h1 className="text-2xl font-bold text-navy-900">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge label={client.healthStatus} status={HEALTH_BADGE[client.healthStatus]} />
            <Badge label={client.tier} status={TIER_BADGE[client.tier]} />
            <Badge label={client.status} status="default" />
            {client.sector && <span className="text-xs text-slate-500">· {client.sector}</span>}
            {client.accountOwner && <span className="text-xs text-slate-500">· owned by {client.accountOwner}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onEdit(client)}>✎ Edit</Button>
          <Button variant="primary" onClick={() => onLogInteraction(client)}>+ Log interaction</Button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {/* Why this account needs attention — stated plainly, above everything else */}
      {client.attentionReasons?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900 mb-1.5">Needs attention</p>
          <ul className="space-y-1">
            {client.attentionReasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-xs text-slate-700">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[r.severity] || 'bg-slate-400'}`} />
                <span><strong className="text-navy-900">{r.label}</strong> — {r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Last contact" value={relativeDays(client.lastContactAt)} />
        <Stat
          label={`Days since contact · target ${client.expectedCadenceDays}`}
          value={client.daysSinceLastContact ?? '—'}
          tone={
            client.daysSinceLastContact !== null && client.daysSinceLastContact > client.expectedCadenceDays
              ? 'warn'
              : 'default'
          }
        />
        <Stat label="Open commitments" value={openCommitments.length} tone={client.overdueCommitments?.length ? 'warn' : 'default'} />
        <Stat label="Satisfaction" value={client.satisfactionScore ? `${client.satisfactionScore}/5` : '—'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === t.id ? 'border-navy-700 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'
            }`}
          >
            {t.label}
            {t.id === 'timeline' && interactions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{interactions.length}</span>
            )}
            {t.id === 'commitments' && openCommitments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">{openCommitments.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* --- Overview --- */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">Contacts</h3>
            {(client.contacts || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No contacts recorded.</p>
            ) : (
              <div className="space-y-2">
                {client.contacts.map((c) => (
                  <div key={c._id || c.name} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-navy-900">{c.name}</span>
                      {c.isPrimary && <Badge label="Primary" status="active" />}
                    </div>
                    {c.role && <p className="text-xs text-slate-500">{c.role}</p>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-navy-700 hover:underline">{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-navy-700 hover:underline">{c.phone}</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">Relationship</h3>
            <MetaRow label="Tier">{client.tier} — every {client.expectedCadenceDays} days</MetaRow>
            <MetaRow label="Status">{client.status}</MetaRow>
            <MetaRow label="Account owner">{client.accountOwner || '—'}</MetaRow>
            <MetaRow label="Client since">{formatDate(client.relationshipStart)}</MetaRow>
            <MetaRow label="Contract value">{client.contractValue ? formatMoney(client.contractValue) : '—'}</MetaRow>
            <MetaRow label="Renewal">
              {client.renewalDate
                ? `${formatDate(client.renewalDate)}${client.daysToRenewal !== null ? ` (${client.daysToRenewal}d)` : ''}`
                : '—'}
            </MetaRow>
            <MetaRow label="Last contact">
              {client.lastContactAt
                ? `${relativeDays(client.lastContactAt)} · ${client.lastContactType} by ${client.lastContactBy}`
                : 'Never'}
            </MetaRow>
            {client.sourcePipelineItem && (
              <MetaRow label="Came from">{client.sourcePipelineItem.name} (pipeline)</MetaRow>
            )}
            {client.linkedCaseStudy && (
              <MetaRow label="Case study">
                {client.linkedCaseStudy.title}
                {client.linkedCaseStudy.quantifiableResults ? ` — ${client.linkedCaseStudy.quantifiableResults}` : ''}
              </MetaRow>
            )}
          </div>

          <ClientAppreciation client={client} refreshToken={refreshToken} />

          {client.notes && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-semibold text-navy-900 mb-1">Notes</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {client.tags?.length > 0 && (
            <div className="lg:col-span-2 flex flex-wrap gap-1.5">
              {client.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-200 text-xs">#{t}</span>
              ))}
            </div>
          )}

          {/* Destructive actions kept at the bottom of Overview, archive-first. */}
          <div className="lg:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" onClick={toggleArchive}>
              {client.archived ? '↩ Restore' : '🗄 Archive'}
            </Button>
            {client.archived && !confirmDelete && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete permanently</Button>
            )}
          </div>

          {confirmDelete && (
            <div className="lg:col-span-2 px-3 py-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
              <p className="text-xs text-red-800">
                This permanently destroys <strong>{client.name}</strong> and all {interactions.length} logged
                interaction(s). It cannot be undone — type the client name to confirm.
              </p>
              <input
                type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={client.name} className="form-input"
                aria-label="Type the client name to confirm deletion"
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setConfirmDelete(false); setDeleteInput(''); }}>Keep it</Button>
                <Button
                  variant="danger" disabled={deleteInput.trim() !== client.name}
                  className="disabled:opacity-40 disabled:cursor-not-allowed" onClick={hardDelete}
                >
                  Delete permanently
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Timeline --- */}
      {tab === 'timeline' && (
        <div className="space-y-2">
          {interactions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">Nothing logged against this account yet.</p>
              <div className="flex justify-center mt-3">
                <Button variant="primary" onClick={() => onLogInteraction(client)}>+ Log the first interaction</Button>
              </div>
            </div>
          ) : (
            interactions.map((i) => (
              <div key={i._id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-lg shrink-0" aria-hidden="true">{INTERACTION_ICON[i.type]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900">{i.summary}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {i.type}
                        {i.contactName ? ` with ${i.contactName}` : ''} · {i.loggedBy} · {formatDate(i.occurredAt)}
                      </p>
                      {i.detail && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{i.detail}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-sm" title={i.sentiment}>{SENTIMENT_ICON[i.sentiment]}</span>
                    <button
                      type="button"
                      onClick={() => removeInteraction(i._id)}
                      aria-label={`Delete interaction: ${i.summary}`}
                      className="text-slate-300 hover:text-red-600 cursor-pointer text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- Commitments --- */}
      {tab === 'commitments' && (
        <div className="space-y-4">
          <form onSubmit={addCommitment} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-navy-900">What did we promise?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text" value={commitmentDraft.description}
                onChange={(e) => setCommitmentDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Send revised pricing" className="form-input sm:col-span-2"
              />
              <input
                type="date" value={commitmentDraft.dueDate}
                onChange={(e) => setCommitmentDraft((d) => ({ ...d, dueDate: e.target.value }))}
                className="form-input"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" type="submit" disabled={!commitmentDraft.description.trim()}>Add commitment</Button>
            </div>
          </form>

          {openCommitments.length === 0 && doneCommitments.length === 0 ? (
            <p className="text-xs text-slate-500">No commitments recorded.</p>
          ) : (
            <>
              {openCommitments.map((c) => {
                const overdue = c.dueDate && new Date(c.dueDate) < new Date();
                return (
                  <div key={c._id} className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox" checked={false} onChange={() => toggleCommitment(c._id, true)}
                        className="mt-0.5 accent-forest-600 cursor-pointer"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-navy-900">{c.description}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {c.owner ? `${c.owner} · ` : ''}
                          {c.dueDate ? (overdue ? `overdue since ${formatDate(c.dueDate)}` : `due ${formatDate(c.dueDate)}`) : 'no due date'}
                        </span>
                      </span>
                    </label>
                    <button onClick={() => removeCommitment(c._id)} className="shrink-0 text-xs text-slate-400 hover:text-red-700 cursor-pointer">&times;</button>
                  </div>
                );
              })}
              {doneCommitments.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Kept</p>
                  {doneCommitments.map((c) => (
                    <div key={c._id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox" checked onChange={() => toggleCommitment(c._id, false)}
                          className="accent-forest-600 cursor-pointer"
                        />
                        <span className="text-sm text-slate-400 line-through truncate">{c.description}</span>
                      </label>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatDate(c.completedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* --- Satisfaction --- */}
      {tab === 'satisfaction' && (
        <div className="space-y-4">
          <form onSubmit={recordSurvey} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-navy-900">Record a check-in score</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n} type="button"
                  onClick={() => setSurveyDraft((d) => ({ ...d, score: n }))}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${
                    surveyDraft.score === n
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="text-xs text-slate-500 ml-2">1 = unhappy · 5 = delighted</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text" value={surveyDraft.respondent}
                onChange={(e) => setSurveyDraft((d) => ({ ...d, respondent: e.target.value }))}
                placeholder="Who gave the score" className="form-input"
              />
              <input
                type="text" value={surveyDraft.comment}
                onChange={(e) => setSurveyDraft((d) => ({ ...d, comment: e.target.value }))}
                placeholder="What they said, in their words" className="form-input sm:col-span-2"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" type="submit">Record score</Button>
            </div>
          </form>

          {surveys.length === 0 ? (
            <p className="text-xs text-slate-500">
              No satisfaction scores yet. The trend matters more than any single number —
              record one at each check-in.
            </p>
          ) : (
            <div className="space-y-2">
              {surveys.map((s, index) => {
                const prev = surveys[index + 1];
                const delta = prev ? s.score - prev.score : 0;
                return (
                  <div key={s._id} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-navy-900">{s.score}/5</span>
                        {delta !== 0 && (
                          <span className={`text-xs font-medium ${delta > 0 ? 'text-forest-700' : 'text-red-700'}`}>
                            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{formatDate(s.collectedAt)}</span>
                        <button
                          type="button"
                          onClick={() => removeSurvey(s._id)}
                          aria-label={`Remove survey scored ${s.score}`}
                          className="text-slate-300 hover:text-red-600 cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {s.comment && <p className="text-sm text-slate-700 italic mt-1">“{s.comment}”</p>}
                    {(s.respondent || s.collectedBy) && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {s.respondent || 'Client'}{s.collectedBy ? ` · collected by ${s.collectedBy}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientRecordView;
