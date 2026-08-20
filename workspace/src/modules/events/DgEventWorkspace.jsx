import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import FormCard from '../../components/common/FormCard';
import { DG_DEPARTMENTS, DG_PROPOSAL_TYPES, DG_PROPOSAL_STATUSES } from './eventConstants';

const proposalTone = {
  Approved: 'success', Declined: 'danger', 'Under Review': 'ongoing', Submitted: 'default',
};

const emptyEdition = {
  dgEventTitle: '', fiscalYear: new Date().getFullYear(), overallTheme: '',
  totalBudgetAllocated: '', budgetSpent: '', eventDate: '', venue: '', executiveSponsor: '',
};

const emptyProposal = {
  submittedBy: '', department: DG_DEPARTMENTS[0], proposalType: DG_PROPOSAL_TYPES[0],
  title: '', details: '', requestedAmount: '',
};

const DgEventWorkspace = () => {
  const [editions, setEditions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [newEdition, setNewEdition] = useState(emptyEdition);
  const [submitting, setSubmitting] = useState(false);

  const [taskDrafts, setTaskDrafts] = useState({});
  const [proposal, setProposal] = useState(emptyProposal);
  const [expandedPhase, setExpandedPhase] = useState(null);

  useEffect(() => {
    let ignore = false;
    bdApi.getDgEvents()
      .then((data) => {
        if (ignore) return;
        setEditions(data);
        if (data.length) setActiveId(data[0]._id);
      })
      .catch((err) => {
        console.error('Failed to load DG events:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const active = editions.find((e) => e._id === activeId) || null;

  const upsert = (edition) => {
    setEditions((prev) => {
      const idx = prev.findIndex((e) => e._id === edition._id);
      if (idx === -1) return [edition, ...prev];
      const next = [...prev];
      next[idx] = edition;
      return next;
    });
  };

  const createEdition = async () => {
    setSubmitting(true);
    try {
      const created = await bdApi.addDgEvent({
        ...newEdition,
        fiscalYear: Number(newEdition.fiscalYear),
        totalBudgetAllocated: Number(newEdition.totalBudgetAllocated) || 0,
        budgetSpent: Number(newEdition.budgetSpent) || 0,
        eventDate: newEdition.eventDate || null,
      });
      upsert(created);
      setActiveId(created._id);
      setNewEdition(emptyEdition);
      setShowNew(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addTask = async (phaseId) => {
    const draft = taskDrafts[phaseId];
    if (!draft?.taskName?.trim()) return;
    try {
      const updated = await bdApi.addDgPhaseTask(active._id, phaseId, {
        ...draft,
        dueDate: draft.dueDate || null,
      });
      upsert(updated);
      setTaskDrafts((d) => ({ ...d, [phaseId]: { taskName: '', department: DG_DEPARTMENTS[0], teamLead: '', dueDate: '' } }));
    } catch (err) {
      alert(`Error adding task: ${err.message}`);
    }
  };

  const toggleTask = async (phaseId, taskId, completed) => {
    try {
      upsert(await bdApi.updateDgPhaseTask(active._id, phaseId, taskId, { completed }));
    } catch (err) {
      alert(`Error updating task: ${err.message}`);
    }
  };

  const removeTask = async (phaseId, taskId) => {
    try {
      upsert(await bdApi.deleteDgPhaseTask(active._id, phaseId, taskId));
    } catch (err) {
      alert(`Error deleting task: ${err.message}`);
    }
  };

  const submitProposal = async (e) => {
    e.preventDefault();
    if (!proposal.submittedBy.trim() || !proposal.title.trim()) return;
    try {
      const updated = await bdApi.submitDgProposal(active._id, {
        ...proposal,
        requestedAmount: proposal.requestedAmount ? Number(proposal.requestedAmount) : undefined,
      });
      upsert(updated);
      setProposal(emptyProposal);
    } catch (err) {
      alert(`Error submitting proposal: ${err.message}`);
    }
  };

  const reviewProposal = async (proposalId, status) => {
    try {
      upsert(await bdApi.reviewDgProposal(active._id, proposalId, { status }));
    } catch (err) {
      alert(`Error reviewing proposal: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {editions.length > 0 && (
            <select value={activeId || ''} onChange={(e) => setActiveId(e.target.value)} className="form-input text-sm">
              {editions.map((e) => (
                <option key={e._id} value={e._id}>{e.dgEventTitle} ({e.fiscalYear})</option>
              ))}
            </select>
          )}
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>+ New Edition</Button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {!active ? (
        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          No DG edition yet. Create one to start the year-long planning journey.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="text-center py-4">
              <span className="text-2xl font-bold text-navy-900">{active.overallProgress ?? 0}%</span>
              <p className="text-xs text-slate-500 mt-1">Overall Progress</p>
            </Card>
            <Card className="text-center py-4">
              <span className="text-sm font-semibold text-navy-900 leading-tight block">{active.currentPhase || '—'}</span>
              <p className="text-xs text-slate-500 mt-1">Current Phase</p>
            </Card>
            <Card className="text-center py-4">
              <span className="text-2xl font-bold text-navy-900">${Number(active.totalBudgetAllocated || 0).toLocaleString()}</span>
              <p className="text-xs text-slate-500 mt-1">Budget Allocated</p>
            </Card>
            <Card className="text-center py-4">
              <span className={`text-2xl font-bold ${(active.budgetRemaining ?? 0) < 0 ? 'text-red-600' : 'text-navy-900'}`}>
                ${Number(active.budgetRemaining ?? 0).toLocaleString()}
              </span>
              <p className="text-xs text-slate-500 mt-1">Budget Remaining</p>
            </Card>
          </div>

          {active.overallTheme && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Theme</p>
              <p className="text-sm text-slate-700">{active.overallTheme}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                {active.eventDate && <span>🗓 {new Date(active.eventDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>}
                {active.venue && <span>📍 {active.venue}</span>}
                {active.executiveSponsor && <span>👤 {active.executiveSponsor}</span>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-navy-900">Phased Lifecycle</h3>
            {(active.phases || []).sort((a, b) => a.order - b.order).map((phase) => {
              const prog = active.phaseProgress?.find((p) => p.name === phase.name)?.progress ?? 0;
              const isOpen = expandedPhase === phase._id;
              const draft = taskDrafts[phase._id] || { taskName: '', department: DG_DEPARTMENTS[0], teamLead: '', dueDate: '' };
              return (
                <div key={phase._id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedPhase(isOpen ? null : phase._id)}
                    className="w-full text-left px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        prog === 100 ? 'bg-forest-500 text-white' : prog > 0 ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {prog === 100 ? '✓' : phase.order}
                      </span>
                      <span className="text-sm font-medium text-navy-900 flex-1">{phase.name}</span>
                      <span className="text-xs text-slate-500">{phase.tasks?.length || 0} tasks · {prog}%</span>
                      <span className="text-slate-400 text-xs">{isOpen ? '▾' : '▸'}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full transition-all ${prog === 100 ? 'bg-forest-500' : 'bg-navy-500'}`} style={{ width: `${prog}%` }} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
                      {(phase.tasks || []).length === 0 ? (
                        <p className="text-xs text-slate-400">No tasks assigned in this phase yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {phase.tasks.map((t) => (
                            <li key={t._id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={t.completed} onChange={(e) => toggleTask(phase._id, t._id, e.target.checked)} />
                              <span className={t.completed ? 'line-through text-slate-400' : 'text-slate-700'}>{t.taskName}</span>
                              {t.department && <span className="text-[11px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{t.department}</span>}
                              {t.teamLead && <span className="text-xs text-slate-500">{t.teamLead}</span>}
                              {t.dueDate && <span className="text-xs text-slate-400">{new Date(t.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>}
                              <button type="button" onClick={() => removeTask(phase._id, t._id)} className="ml-auto text-red-600 hover:text-red-700 text-xs cursor-pointer">Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center pt-2 border-t border-slate-200">
                        <input type="text" value={draft.taskName} onChange={(e) => setTaskDrafts((d) => ({ ...d, [phase._id]: { ...draft, taskName: e.target.value } }))} className="form-input" placeholder="New task" />
                        <select value={draft.department} onChange={(e) => setTaskDrafts((d) => ({ ...d, [phase._id]: { ...draft, department: e.target.value } }))} className="form-input">
                          {DG_DEPARTMENTS.map((dp) => <option key={dp} value={dp}>{dp}</option>)}
                        </select>
                        <input type="text" value={draft.teamLead} onChange={(e) => setTaskDrafts((d) => ({ ...d, [phase._id]: { ...draft, teamLead: e.target.value } }))} className="form-input" placeholder="Team lead" />
                        <input type="date" value={draft.dueDate} onChange={(e) => setTaskDrafts((d) => ({ ...d, [phase._id]: { ...draft, dueDate: e.target.value } }))} className="form-input" />
                        <Button variant="secondary" className="text-xs px-3 py-2" onClick={() => addTask(phase._id)}>Add</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <FormCard
            title="Team Idea & Budget Submissions"
            description="Anyone can submit a session proposal or resource request for executive review."
            onSubmit={submitProposal}
            footer={<Button type="submit" variant="primary">Submit Proposal</Button>}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Submitted By *</label>
                <input type="text" value={proposal.submittedBy} onChange={(e) => setProposal((p) => ({ ...p, submittedBy: e.target.value }))} className="w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Department</label>
                <select value={proposal.department} onChange={(e) => setProposal((p) => ({ ...p, department: e.target.value }))} className="w-full form-input">
                  {DG_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Type</label>
                <select value={proposal.proposalType} onChange={(e) => setProposal((p) => ({ ...p, proposalType: e.target.value }))} className="w-full form-input">
                  {DG_PROPOSAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Requested Amount ($)</label>
                <input type="number" min="0" value={proposal.requestedAmount} onChange={(e) => setProposal((p) => ({ ...p, requestedAmount: e.target.value }))} className="w-full form-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Title *</label>
              <input type="text" value={proposal.title} onChange={(e) => setProposal((p) => ({ ...p, title: e.target.value }))} className="w-full form-input" placeholder="e.g. Add a fireside chat on AI adoption" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Details</label>
              <textarea value={proposal.details} onChange={(e) => setProposal((p) => ({ ...p, details: e.target.value }))} rows={2} className="w-full form-input resize-y" />
            </div>
          </FormCard>

          {(active.proposals || []).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-navy-900">Submissions ({active.proposals.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {active.proposals.map((p) => (
                  <div key={p._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-navy-900 text-sm">{p.title}</span>
                      <Badge label={p.status} status={proposalTone[p.status] || 'default'} />
                    </div>
                    <p className="text-xs text-slate-500">{p.submittedBy} · {p.department} · {p.proposalType}</p>
                    {p.details && <p className="text-xs text-slate-600">{p.details}</p>}
                    {p.requestedAmount > 0 && <p className="text-xs text-slate-600">Requested: ${Number(p.requestedAmount).toLocaleString()}</p>}
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      {DG_PROPOSAL_STATUSES.filter((s) => s !== p.status).map((s) => (
                        <button key={s} type="button" onClick={() => reviewProposal(p._id, s)} className="text-xs text-navy-700 hover:underline cursor-pointer">{s}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New DG Annual Edition"
        description="Five planning phases are created automatically."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="button" variant="primary" onClick={createEdition} disabled={submitting || !newEdition.dgEventTitle.trim()}>
              {submitting ? 'Creating...' : 'Create Edition'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Edition Title *</label>
              <input type="text" value={newEdition.dgEventTitle} onChange={(e) => setNewEdition((n) => ({ ...n, dgEventTitle: e.target.value }))} className="w-full form-input" placeholder="e.g. DG Annual Strategic Summit 2026" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Fiscal Year</label>
              <input type="number" value={newEdition.fiscalYear} onChange={(e) => setNewEdition((n) => ({ ...n, fiscalYear: e.target.value }))} className="w-full form-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Overall Theme</label>
            <textarea value={newEdition.overallTheme} onChange={(e) => setNewEdition((n) => ({ ...n, overallTheme: e.target.value }))} rows={2} className="w-full form-input resize-y" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Total Budget ($)</label>
              <input type="number" min="0" value={newEdition.totalBudgetAllocated} onChange={(e) => setNewEdition((n) => ({ ...n, totalBudgetAllocated: e.target.value }))} className="w-full form-input" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Target Event Date</label>
              <input type="date" value={newEdition.eventDate} onChange={(e) => setNewEdition((n) => ({ ...n, eventDate: e.target.value }))} className="w-full form-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Venue</label>
              <input type="text" value={newEdition.venue} onChange={(e) => setNewEdition((n) => ({ ...n, venue: e.target.value }))} className="w-full form-input" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Executive Sponsor</label>
              <input type="text" value={newEdition.executiveSponsor} onChange={(e) => setNewEdition((n) => ({ ...n, executiveSponsor: e.target.value }))} className="w-full form-input" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DgEventWorkspace;
