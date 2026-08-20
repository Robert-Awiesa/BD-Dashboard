import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  CLOSED_STAGES,
  LOSS_REASONS,
  OPEN_STAGES,
  ORIGIN_ICON,
  SEVERITY_DOT,
  STAGE_BADGE,
  deadlineLabel,
  formatDate,
  formatMoney,
} from './proposalConstants';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'checklist', label: 'Bid checklist' },
  { id: 'followups', label: 'Follow-ups' },
];

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const ProposalDetailModal = ({ open, onClose, proposal, onChanged, onEdit, onDelete }) => {
  const { currentUser, bumpClientData } = useDashboard();
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [outcome, setOutcome] = useState({ stage: '', lossReason: '', outcomeNote: '', competitor: '' });
  const [checkDraft, setCheckDraft] = useState({ taskName: '', assignedTo: '', dueDate: '' });
  const [followDraft, setFollowDraft] = useState({ note: '', response: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!proposal) return null;
  const closed = CLOSED_STAGES.includes(proposal.stage);

  const apply = (updated) => {
    onChanged(updated);
    bumpClientData(); // proposal checklist items show up in Tasks → My work
  };

  const moveStage = async (stage) => {
    // Closing a bid needs the outcome captured in the same action, so those
    // stages open a small form rather than moving straight away.
    if (stage === 'Lost' || stage === 'Won' || stage === 'Withdrawn') {
      setOutcome({ stage, lossReason: '', outcomeNote: '', competitor: '' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      apply(await bdApi.setProposalStage(proposal._id, { stage }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const commitOutcome = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      apply(await bdApi.setProposalStage(proposal._id, outcome));
      setOutcome({ stage: '', lossReason: '', outcomeNote: '', competitor: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addCheck = async (e) => {
    e.preventDefault();
    if (!checkDraft.taskName.trim()) return;
    try {
      apply(await bdApi.addProposalChecklistItem(proposal._id, checkDraft));
      setCheckDraft({ taskName: '', assignedTo: '', dueDate: '' });
    } catch (err) { setError(err.message); }
  };

  const addFollowUp = async (e) => {
    e.preventDefault();
    if (!followDraft.note.trim()) return;
    try {
      apply(await bdApi.addProposalFollowUp(proposal._id, { ...followDraft, by: currentUser }));
      setFollowDraft({ note: '', response: '' });
    } catch (err) { setError(err.message); }
  };

  const toggleArchive = async () => {
    try {
      await bdApi.setProposalArchived(proposal._id, !proposal.archived);
      apply(await bdApi.getProposal(proposal._id));
      setConfirmDelete(false);
    } catch (err) { setError(err.message); }
  };

  const who = proposal.client?.name || proposal.prospectName;
  const followUps = [...(proposal.followUps || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        {formatMoney(proposal.value)} · weighted {formatMoney(proposal.weightedValue)}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={toggleArchive}>
          {proposal.archived ? '↩ Restore' : '🗄 Archive'}
        </Button>
        {proposal.archived && !confirmDelete && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
        )}
        <Button variant="primary" onClick={() => onEdit(proposal)}>✎ Edit</Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={proposal.title}
      description={`${ORIGIN_ICON[proposal.origin] || ''} ${proposal.origin} · ${who}${proposal.reference ? ` · ${proposal.reference}` : ''}`}
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {/* Stage pipeline */}
        <div className="flex flex-wrap items-center gap-1.5">
          {OPEN_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => moveStage(s)}
              disabled={busy || closed || s === proposal.stage}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                s === proposal.stage
                  ? 'bg-navy-700 text-white border-navy-700 cursor-default'
                  : closed
                    ? 'bg-white text-slate-300 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400 cursor-pointer'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="mx-1 text-slate-300">|</span>
          {CLOSED_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => moveStage(s)}
              disabled={busy || s === proposal.stage}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                s === proposal.stage
                  ? 'bg-navy-700 text-white border-navy-700 cursor-default'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400 cursor-pointer'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Closing a bid captures the outcome in the same action */}
        {outcome.stage && (
          <form onSubmit={commitOutcome} className={`rounded-xl border px-4 py-3 space-y-3 ${
            outcome.stage === 'Won' ? 'border-forest-300 bg-forest-50' : 'border-amber-300 bg-amber-50'
          }`}>
            <p className="text-sm font-semibold text-navy-900">
              Closing as {outcome.stage}
            </p>
            {outcome.stage === 'Lost' && (
              <div>
                <label className="form-label">Why did we lose it? <span className="text-red-600">*</span></label>
                <select
                  value={outcome.lossReason}
                  onChange={(e) => setOutcome((o) => ({ ...o, lossReason: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Pick a reason…</option>
                  {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-xs text-slate-600 mt-1">
                  Required. An unexplained loss teaches the team nothing — this is the field the
                  win/loss analysis is built on.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text" value={outcome.competitor}
                onChange={(e) => setOutcome((o) => ({ ...o, competitor: e.target.value }))}
                placeholder="Who won it (if known)" className="form-input"
              />
              <input
                type="text" value={outcome.outcomeNote}
                onChange={(e) => setOutcome((o) => ({ ...o, outcomeNote: e.target.value }))}
                placeholder="What made the difference" className="form-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOutcome({ stage: '', lossReason: '', outcomeNote: '', competitor: '' })}>
                Cancel
              </Button>
              <Button
                variant="primary" type="submit"
                disabled={busy || (outcome.stage === 'Lost' && !outcome.lossReason)}
              >
                Record {outcome.stage}
              </Button>
            </div>
          </form>
        )}

        {proposal.attentionReasons?.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-900 mb-1.5">Needs attention</p>
            <ul className="space-y-1">
              {proposal.attentionReasons.map((r) => (
                <li key={r.code} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[r.severity] || 'bg-slate-400'}`} />
                  <span><strong className="text-navy-900">{r.label}</strong> — {r.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirmDelete && (
          <div className="px-3 py-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
            <p className="text-xs text-red-800">
              Delete <strong>{proposal.title}</strong> permanently? Its win/loss record goes with it.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              <Button variant="danger" onClick={() => onDelete(proposal)}>Delete</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{formatMoney(proposal.value)}</p>
            <p className="text-[11px] text-slate-500">Value</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{Math.round(proposal.winProbability * 100)}%</p>
            <p className="text-[11px] text-slate-500">Win probability</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className={`text-lg font-bold ${proposal.daysToDeadline < 0 ? 'text-red-700' : 'text-navy-900'}`}>
              {proposal.daysToDeadline !== null ? deadlineLabel(proposal.daysToDeadline) : '—'}
            </p>
            <p className="text-[11px] text-slate-500">Deadline</p>
          </div>
        </div>

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
              {t.id === 'checklist' && proposal.openChecklistItems > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                  {proposal.openChecklistItems}
                </span>
              )}
              {t.id === 'followups' && followUps.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{followUps.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* --- Overview --- */}
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge label={proposal.stage} status={STAGE_BADGE[proposal.stage]} />
              {proposal.isCold && <Badge label="Gone cold" status="danger" />}
              {proposal.archived && <Badge label="Archived" status="cold" />}
            </div>

            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <MetaRow label="For">{who}</MetaRow>
              {proposal.sector && <MetaRow label="Sector">{proposal.sector}</MetaRow>}
              <MetaRow label="Bid lead">{proposal.owner || '—'}</MetaRow>
              {proposal.contributors?.length > 0 && (
                <MetaRow label="Contributors">{proposal.contributors.join(', ')}</MetaRow>
              )}
              {proposal.contactName && <MetaRow label="Their contact">{proposal.contactName}</MetaRow>}
              {proposal.issuedDate && <MetaRow label="Received">{formatDate(proposal.issuedDate)}</MetaRow>}
              {proposal.submissionDeadline && (
                <MetaRow label="Deadline">{formatDate(proposal.submissionDeadline)}</MetaRow>
              )}
              {proposal.submittedDate && <MetaRow label="Submitted">{formatDate(proposal.submittedDate)}</MetaRow>}
              {proposal.decisionExpected && (
                <MetaRow label="Decision expected">{formatDate(proposal.decisionExpected)}</MetaRow>
              )}
              {proposal.decidedDate && <MetaRow label="Decided">{formatDate(proposal.decidedDate)}</MetaRow>}
              {proposal.lossReason && <MetaRow label="Lost because">{proposal.lossReason}</MetaRow>}
              {proposal.competitor && <MetaRow label="Lost to">{proposal.competitor}</MetaRow>}
              {proposal.outcomeNote && <MetaRow label="Outcome note">{proposal.outcomeNote}</MetaRow>}
            </div>

            {/* Linked records — proof the module borrows rather than duplicates */}
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Attached</p>
              {proposal.proposalDoc ? (
                <MetaRow label="Document">
                  <a href={proposal.proposalDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                     className="text-navy-700 underline">
                    {proposal.proposalDoc.title} (v{proposal.proposalDoc.version}) ↗
                  </a>
                </MetaRow>
              ) : (
                <MetaRow label="Document">
                  <span className="text-slate-400">none — file it in Reports &amp; Docs and link it</span>
                </MetaRow>
              )}
              {proposal.linkedTender && <MetaRow label="From tender">{proposal.linkedTender.title}</MetaRow>}
              {proposal.caseStudies?.length > 0 && (
                <MetaRow label="Case studies">
                  {proposal.caseStudies.map((c) => c.title).join(', ')}
                </MetaRow>
              )}
            </div>

            {proposal.notes && (
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{proposal.notes}</p>
              </div>
            )}

            {proposal.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {proposal.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-200 text-xs">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Checklist --- */}
        {tab === 'checklist' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Assigned items appear in that person&rsquo;s <strong>My work</strong> under Tasks &amp; Projects,
              inheriting this deadline when they have none of their own.
            </p>
            <form onSubmit={addCheck} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text" value={checkDraft.taskName}
                onChange={(e) => setCheckDraft((d) => ({ ...d, taskName: e.target.value }))}
                placeholder="Pricing section" className="form-input sm:col-span-2"
              />
              <input
                type="text" value={checkDraft.assignedTo}
                onChange={(e) => setCheckDraft((d) => ({ ...d, assignedTo: e.target.value }))}
                placeholder="Who" className="form-input"
              />
              <Button variant="primary" type="submit" disabled={!checkDraft.taskName.trim()}>Add</Button>
            </form>

            {(proposal.checklist || []).length === 0 ? (
              <p className="text-xs text-slate-400">Nothing on the checklist yet.</p>
            ) : (
              <div className="space-y-1.5">
                {proposal.checklist.map((c) => (
                  <div key={c._id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox" checked={c.completed}
                        onChange={async () => {
                          try {
                            apply(await bdApi.setProposalChecklistDone(proposal._id, c._id, !c.completed));
                          } catch (err) { setError(err.message); }
                        }}
                        className="accent-forest-600 cursor-pointer"
                      />
                      <span className={`text-sm truncate ${c.completed ? 'text-slate-400 line-through' : 'text-navy-900'}`}>
                        {c.taskName}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.assignedTo && <span className="text-[11px] text-slate-500">{c.assignedTo}</span>}
                      <button
                        onClick={async () => {
                          try {
                            apply(await bdApi.deleteProposalChecklistItem(proposal._id, c._id));
                          } catch (err) { setError(err.message); }
                        }}
                        className="text-xs text-slate-400 hover:text-red-700 cursor-pointer"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Follow-ups --- */}
        {tab === 'followups' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-600">
                {proposal.daysSinceContact !== null
                  ? <>Last contact <strong className="text-navy-900">{proposal.daysSinceContact} day(s)</strong> ago.
                      Logging a chase resets the clock that marks a bid cold.</>
                  : 'Follow-ups start counting once the proposal is submitted.'}
              </p>
            </div>

            <form onSubmit={addFollowUp} className="space-y-2">
              <input
                type="text" value={followDraft.note}
                onChange={(e) => setFollowDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="Called the procurement lead" className="form-input"
              />
              <input
                type="text" value={followDraft.response}
                onChange={(e) => setFollowDraft((d) => ({ ...d, response: e.target.value }))}
                placeholder="What they said (optional)" className="form-input"
              />
              <div className="flex justify-end">
                <Button variant="primary" type="submit" disabled={!followDraft.note.trim()}>Log follow-up</Button>
              </div>
            </form>

            {followUps.length === 0 ? (
              <p className="text-xs text-slate-400">No follow-ups logged.</p>
            ) : (
              followUps.map((f) => (
                <div key={f._id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-navy-900">{f.note}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{formatDate(f.date)}</span>
                  </div>
                  {f.response && <p className="text-xs text-slate-600 mt-0.5 italic">“{f.response}”</p>}
                  {f.by && <p className="text-[11px] text-slate-400 mt-0.5">{f.by}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProposalDetailModal;
