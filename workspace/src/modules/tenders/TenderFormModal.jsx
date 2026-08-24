import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { bdApi } from '../../context/services/api';
import {
  TENDER_TYPES,
  TENDER_STATUSES,
  SOURCES,
  SECTORS,
  SOURCE_REQUIREMENTS,
  FDP_CURRENCIES,
  BOM_OPTIONS,
  IMPLEMENTATION_COST_STATES,
  emptyTenderForm,
  toDateInput,
} from './tenderConstants';

const blankIndividual = { name: '', responsibility: '', notes: '' };
const blankMilestone = { label: '', date: '', done: false };

const Section = ({ title, hint, children }) => (
  <fieldset className="rounded-xl border border-slate-200 px-4 py-3">
    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-navy-700">{title}</legend>
    {hint && <p className="text-xs text-slate-500 mb-2 -mt-1">{hint}</p>}
    {children}
  </fieldset>
);

const TenderFormModal = ({ open, onClose, onSaved, existing, owners = [], authorities = [] }) => {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(() => {
    if (!existing) return emptyTenderForm;
    return {
      ...emptyTenderForm,
      ...existing,
      openedDate: toDateInput(existing.openedDate),
      deadline: toDateInput(existing.deadline),
      pdp: { ...emptyTenderForm.pdp, ...(existing.pdp || {}) },
      fdp: { ...emptyTenderForm.fdp, ...(existing.fdp || {}) },
    };
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Which "how do we find this again" field this source calls for.
  const requirement = SOURCE_REQUIREMENTS[form.source] || null;

  const uploadSourceImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url, fileName } = await bdApi.uploadTenderSourceImage(file);
      setForm((f) => ({ ...f, sourceImageUrl: url, sourceImageName: fileName }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setPdp = (field, value) => setForm((f) => ({ ...f, pdp: { ...f.pdp, [field]: value } }));
  const setFdp = (field, value) => setForm((f) => ({ ...f, fdp: { ...f.fdp, [field]: value } }));

  const addIndividual = () =>
    setPdp('individuals', [...form.pdp.individuals, { ...blankIndividual }]);
  const updateIndividual = (i, field, value) =>
    setPdp('individuals', form.pdp.individuals.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeIndividual = (i) =>
    setPdp('individuals', form.pdp.individuals.filter((_, idx) => idx !== i));

  const addMilestone = () =>
    setPdp('milestones', [...form.pdp.milestones, { ...blankMilestone }]);
  const updateMilestone = (i, field, value) =>
    setPdp('milestones', form.pdp.milestones.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeMilestone = (i) =>
    setPdp('milestones', form.pdp.milestones.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Give the tender a title');
      return;
    }
    if (requirement && !String(form[requirement.field] || '').trim()) {
      setError(`${form.source} tenders need "${requirement.label}" — without it nobody can find this tender again.`);
      return;
    }
    if (form.sector === 'Others' && !form.customSector.trim()) {
      setError('Say which sector this is.');
      return;
    }
    if (form.openedDate && form.deadline && form.openedDate > form.deadline) {
      setError('The tender cannot open after its own deadline.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        estimatedValue: form.estimatedValue === '' ? 0 : Number(form.estimatedValue),
        pdp: {
          ...form.pdp,
          progress: Number(form.pdp.progress) || 0,
          individuals: form.pdp.individuals.filter((r) => r.name.trim() || r.responsibility.trim()),
          milestones: form.pdp.milestones.filter((m) => m.label.trim() || m.date),
        },
        fdp: form.fdp,
      };
      const saved = isEdit
        ? await bdApi.updateTender(existing._id, payload)
        : await bdApi.addTender(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? 'Edit tender' : 'New tender'}
      description="Capture the notice, then build out the Proposal and Financial Development Plans."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" onClick={submit} type="button" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create tender'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="form-label">Tender title *</label>
            <input
              type="text" className="form-input" required value={form.title}
              onChange={(e) => set('title', e.target.value)} placeholder="e.g. National Fibre Rollout — Lot 3"
            />
          </div>
          <div>
            <label className="form-label">Reference / ref no.</label>
            <input type="text" className="form-input" value={form.reference}
              onChange={(e) => set('reference', e.target.value)} placeholder="T/2026/014" />
          </div>
          <div>
            <label className="form-label">Issuing authority</label>
            <input type="text" className="form-input" value={form.issuingAuthority}
              list="tender-authorities"
              onChange={(e) => set('issuingAuthority', e.target.value)} placeholder="Ministry of …" />
          </div>
          <div>
            <label className="form-label">Owner</label>
            <input type="text" list="tender-owners" className="form-input" value={form.owner}
              onChange={(e) => set('owner', e.target.value)} placeholder="Who is accountable" />
            <p className="text-xs text-slate-500 mt-1">
              Deadline reminders are addressed to this person.
            </p>
          </div>
          <div>
            <label className="form-label">Sector</label>
            <select className="form-input" value={form.sector} onChange={(e) => set('sector', e.target.value)}>
              <option value="">Select…</option>
              {SECTORS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          {form.sector === 'Others' && (
            <div>
              <label className="form-label">Which sector? *</label>
              <input type="text" className="form-input" value={form.customSector}
                onChange={(e) => set('customSector', e.target.value)} placeholder="e.g. Transportation" />
            </div>
          )}
          <div>
            <label className="form-label">Tender type</label>
            <select className="form-input" value={form.tenderType} onChange={(e) => set('tenderType', e.target.value)}>
              {TENDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {TENDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Source</label>
            <select className="form-input" value={form.source} onChange={(e) => set('source', e.target.value)}>
              <option value="">Select…</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {requirement?.kind === 'url' && (
            <div>
              <label className="form-label">{requirement.label} *</label>
              <input type="url" className="form-input" value={form.sourceLink}
                onChange={(e) => set('sourceLink', e.target.value)}
                placeholder="https://…" />
            </div>
          )}
          {requirement?.kind === 'text' && (
            <div>
              <label className="form-label">{requirement.label} *</label>
              <input type="text" className="form-input" value={form.sourceDetail}
                onChange={(e) => set('sourceDetail', e.target.value)}
                placeholder="So anyone can trace it back" />
            </div>
          )}
          {requirement?.kind === 'image' && (
            <div className="sm:col-span-2">
              <label className="form-label">{requirement.label} *</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="text-sm"
                  onChange={(e) => uploadSourceImage(e.target.files?.[0])}
                />
                {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
                {form.sourceImageUrl && !uploading && (
                  <span className="text-xs text-forest-700">
                    ✓ {form.sourceImageName || 'attached'}
                  </span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="form-label">Tender opened</label>
            <input type="date" className="form-input" value={form.openedDate}
              onChange={(e) => set('openedDate', e.target.value)} max={form.deadline || undefined} />
          </div>
          <div>
            <label className="form-label">Deadline</label>
            <input type="date" className="form-input" value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)} min={form.openedDate || undefined} />
          </div>
          <div>
            <label className="form-label">Estimated value</label>
            <input type="number" min="0" className="form-input" value={form.estimatedValue}
              onChange={(e) => set('estimatedValue', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="form-label">Currency</label>
            <input type="text" className="form-input" value={form.currency}
              onChange={(e) => set('currency', e.target.value)} placeholder="GHS" />
          </div>
        </div>

        {!isEdit && (
          <p className="text-xs text-slate-500 px-1">
            Register the notice first. The Proposal and Financial Development
            Plans open on this tender once it is saved.
          </p>
        )}

        {isEdit && (
        <>
        <Section title="PDP — Proposal Development Plan" hint="Planning and progress: who does what, by when.">
          <div className="space-y-2">
            <div>
              <label className="form-label">Objectives</label>
              <textarea className="form-input" rows="2" value={form.pdp.objectives}
                onChange={(e) => setPdp('objectives', e.target.value)} placeholder="What winning this tender depends on" />
            </div>

            <div>
              <label className="form-label">Proposed solution</label>
              <textarea className="form-input" rows="2" value={form.pdp.proposedSolution}
                onChange={(e) => setPdp('proposedSolution', e.target.value)}
                placeholder="What we are putting forward to deliver it" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label !mb-0">Individuals responsible</label>
                <button type="button" onClick={addIndividual}
                  className="text-xs font-medium text-navy-700 hover:underline cursor-pointer">+ Add person</button>
              </div>
              {form.pdp.individuals.length === 0 ? (
                <p className="text-xs text-slate-400">No one assigned yet.</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-1.5 text-[11px] text-slate-500 px-1">
                    <span>Name</span><span>Responsibility / role</span><span>Notes</span><span />
                  </div>
                  {form.pdp.individuals.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-1.5 items-center">
                      <input className="form-input text-sm" value={row.name}
                        onChange={(e) => updateIndividual(i, 'name', e.target.value)} placeholder="Ama" />
                      <input className="form-input text-sm" value={row.responsibility}
                        onChange={(e) => updateIndividual(i, 'responsibility', e.target.value)} placeholder="Pricing" />
                      <input className="form-input text-sm" value={row.notes}
                        onChange={(e) => updateIndividual(i, 'notes', e.target.value)} placeholder="Sign-off by Wed" />
                      <button type="button" onClick={() => removeIndividual(i)}
                        className="text-slate-400 hover:text-red-700 cursor-pointer px-1" aria-label="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label !mb-0">Milestones</label>
                <button type="button" onClick={addMilestone}
                  className="text-xs font-medium text-navy-700 hover:underline cursor-pointer">+ Add milestone</button>
              </div>
              {form.pdp.milestones.length === 0 ? (
                <p className="text-xs text-slate-400">No milestones yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {form.pdp.milestones.map((m, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-center">
                      <input className="form-input text-sm" value={m.label}
                        onChange={(e) => updateMilestone(i, 'label', e.target.value)} placeholder="Draft submitted" />
                      <input type="date" className="form-input text-sm" value={m.date}
                        onChange={(e) => updateMilestone(i, 'date', e.target.value)} />
                      <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                        <input type="checkbox" checked={m.done}
                          onChange={(e) => updateMilestone(i, 'done', e.target.checked)} className="accent-forest-600" />
                        Done
                      </label>
                      <button type="button" onClick={() => removeMilestone(i)}
                        className="text-slate-400 hover:text-red-700 cursor-pointer px-1" aria-label="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Overall progress — {Number(form.pdp.progress) || 0}%</label>
              <input type="range" min="0" max="100" step="5" value={form.pdp.progress}
                onChange={(e) => setPdp('progress', Number(e.target.value))} className="w-full accent-navy-700" />
            </div>

            <div>
              <label className="form-label">PDP notes</label>
              <textarea className="form-input" rows="2" value={form.pdp.notes}
                onChange={(e) => setPdp('notes', e.target.value)} placeholder="Risks, dependencies, open questions" />
            </div>
          </div>
        </Section>

        <Section title="FDP — Financial Development Plan" hint="What we would be quoting for: the SAP model, who it serves, and what has been settled.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Currency</label>
              <select className="form-input" value={form.fdp.currency}
                onChange={(e) => setFdp('currency', e.target.value)}>
                <option value="">Select…</option>
                {FDP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Model</label>
              <input className="form-input" value={form.fdp.model}
                onChange={(e) => setFdp('model', e.target.value)} placeholder="SAP S/4HANA" />
            </div>
            <div>
              <label className="form-label">Users</label>
              <input className="form-input" value={form.fdp.users}
                onChange={(e) => setFdp('users', e.target.value)}
                placeholder="Who will use the system" />
            </div>
            <div>
              <label className="form-label">BOM</label>
              <select className="form-input" value={form.fdp.bom}
                onChange={(e) => setFdp('bom', e.target.value)}>
                <option value="">Select…</option>
                {BOM_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Implementation cost</label>
              <select className="form-input" value={form.fdp.implementationCost}
                onChange={(e) => setFdp('implementationCost', e.target.value)}>
                <option value="">Select…</option>
                {IMPLEMENTATION_COST_STATES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">FDP notes</label>
              <textarea className="form-input" rows="2" value={form.fdp.notes}
                onChange={(e) => setFdp('notes', e.target.value)} placeholder="Licensing questions, scope gaps, what is still to confirm" />
            </div>
          </div>
        </Section>
        </>
        )}

        {isEdit && (
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows="2" value={form.notes}
              onChange={(e) => set('notes', e.target.value)} placeholder="Anything else worth remembering" />
          </div>
        )}
        <datalist id="tender-owners">
          {owners.map((o) => <option key={o} value={o} />)}
        </datalist>
        {/* Authorities already on record, so the same ministry is not filed
            three different ways and then fails to group in the reports. */}
        <datalist id="tender-authorities">
          {authorities.map((a) => <option key={a} value={a} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default TenderFormModal;
