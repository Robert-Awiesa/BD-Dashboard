import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import {
  ORIGINS,
  STAGE_PROBABILITY,
  emptyProposalForm,
  formatMoney,
  toDateInput,
} from './proposalConstants';

const ProposalFormModal = ({ open, onClose, onSaved, currentUser, existing = null, owners = [], sectors = [] }) => {
  const isEditing = Boolean(existing);

  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyProposalForm,
        ...existing,
        client: existing.client?._id || '',
        contributors: (existing.contributors || []).join(', '),
        value: existing.value || '',
        issuedDate: toDateInput(existing.issuedDate),
        submissionDeadline: toDateInput(existing.submissionDeadline),
        decisionExpected: toDateInput(existing.decisionExpected),
        proposalDoc: existing.proposalDoc?._id || '',
        linkedTender: existing.linkedTender?._id || '',
        caseStudies: (existing.caseStudies || []).map((c) => c._id || c),
        tags: existing.tags || [],
      };
    }
    return { ...emptyProposalForm, owner: currentUser || '' };
  });

  useEffect(() => {
    // Every picker points at a record that already exists somewhere else —
    // this module links, it never re-uploads or re-types.
    bdApi.getClients({ sort: 'name' }).then(setClients).catch(() => setClients([]));
    bdApi.getDocuments().then(setDocuments).catch(() => setDocuments([]));
    bdApi.getContentList({ contentType: 'UserStory' }).then(setCaseStudies).catch(() => setCaseStudies([]));
    bdApi.getTenders().then(setTenders).catch(() => setTenders([]));
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleCaseStudy = (id) =>
    setForm((f) => ({
      ...f,
      caseStudies: f.caseStudies.includes(id)
        ? f.caseStudies.filter((c) => c !== id)
        : [...f.caseStudies, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Give the proposal a title.');
    if (!form.client && !form.prospectName.trim()) {
      return setError('Say who this is for — pick a client or type a prospect name.');
    }

    setSubmitting(true);
    try {
      const payload = { ...form, value: Number(form.value) || 0 };
      const saved = isEditing
        ? await bdApi.updateProposal(existing._id, payload)
        : await bdApi.addProposal(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const weighted = Math.round((Number(form.value) || 0) * (STAGE_PROBABILITY[form.stage] ?? 0));

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        {form.value ? `Weighted at ${form.stage}: ${formatMoney(weighted)}` : ''}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="proposal-form" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create proposal'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEditing ? `Edit — ${existing.title}` : 'New proposal'}
      description="A client-facing bid. The document itself stays in Reports & Docs; this tracks the bid around it."
      footer={footer}
    >
      <form id="proposal-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Title <span className="text-red-600">*</span></label>
            <input
              type="text" value={form.title} onChange={update('title')}
              placeholder="Riverbank core banking rollout" className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Our reference</label>
            <input
              type="text" value={form.reference} onChange={update('reference')}
              placeholder="TGTS-2026-014" className="form-input"
            />
          </div>
        </div>

        {/* Who it is for. A bid usually predates any client record, so a plain
            prospect name is a first-class option rather than a fallback. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Existing client</label>
            <select value={form.client} onChange={update('client')} className="form-input">
              <option value="">— not a client yet —</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">
              Prospect name {!form.client && <span className="text-red-600">*</span>}
            </label>
            <input
              type="text" value={form.prospectName} onChange={update('prospectName')}
              placeholder="Riverbank Bank" className="form-input" disabled={Boolean(form.client)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">How it came in</label>
            <select value={form.origin} onChange={update('origin')} className="form-input">
              {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Sector</label>
            <input
              type="text" list="proposal-sectors" value={form.sector}
              onChange={update('sector')} placeholder="FinTech" className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Value</label>
            <input type="number" min="0" value={form.value} onChange={update('value')} className="form-input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Bid lead</label>
            <input
              type="text" list="proposal-owners" value={form.owner}
              onChange={update('owner')} className="form-input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Contributors</label>
            <input
              type="text" value={form.contributors} onChange={update('contributors')}
              placeholder="Comma separated" className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Received / started</label>
            <input type="date" value={form.issuedDate} onChange={update('issuedDate')} className="form-input" />
          </div>
          <div>
            <label className="form-label">Submission deadline</label>
            <input
              type="date" value={form.submissionDeadline}
              onChange={update('submissionDeadline')} className="form-input"
            />
            <p className="text-xs text-slate-500 mt-1">Counted down; missing it is chased hard.</p>
          </div>
          <div>
            <label className="form-label">Decision expected</label>
            <input
              type="date" value={form.decisionExpected}
              onChange={update('decisionExpected')} className="form-input"
            />
          </div>
        </div>

        <div>
          <label className="form-label">Contact at their end</label>
          <input
            type="text" value={form.contactName} onChange={update('contactName')}
            placeholder="Who we are chasing" className="form-input"
          />
        </div>

        {/* --- Links out to the rest of the workspace --- */}
        <div className="pt-3 border-t border-slate-200 space-y-4">
          <div>
            <p className="text-xs font-semibold text-navy-900">Attach what already exists</p>
            <p className="text-xs text-slate-500">
              Nothing is re-uploaded here — the document lives in Reports &amp; Docs and the case
              studies in Blog &amp; Content.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Proposal document</label>
              <select value={form.proposalDoc} onChange={update('proposalDoc')} className="form-input">
                <option value="">— none —</option>
                {documents.map((d) => <option key={d._id} value={d._id}>{d.title} ({d.category})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">From tender / EOI</label>
              <select value={form.linkedTender} onChange={update('linkedTender')} className="form-input">
                <option value="">— none —</option>
                {tenders.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Case studies to include</label>
            {caseStudies.length === 0 ? (
              <p className="text-xs text-slate-400">
                No user stories published yet — add them in Blog &amp; Content.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {caseStudies.map((cs) => (
                  <button
                    key={cs._id}
                    type="button"
                    onClick={() => toggleCaseStudy(cs._id)}
                    className={`px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors ${
                      form.caseStudies.includes(cs._id)
                        ? 'bg-forest-600 text-white border-forest-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-forest-400'
                    }`}
                  >
                    {cs.title}
                    {cs.categorySector ? ` · ${cs.categorySector}` : ''}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Same-sector stories are the strongest social proof in a bid.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 space-y-4">
          <div>
            <label className="form-label">Tags</label>
            <TagInput
              value={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="Multi-year, Consortium, Public sector…"
            />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={update('notes')} rows={3} className="form-input" />
          </div>
        </div>

        <datalist id="proposal-owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
        <datalist id="proposal-sectors">{sectors.map((s) => <option key={s} value={s} />)}</datalist>
      </form>
    </Modal>
  );
};

export default ProposalFormModal;
