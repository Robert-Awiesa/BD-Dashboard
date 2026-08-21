import { useState, useRef } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  EOI_STATUSES,
  SOURCES,
  STATUS_BADGE,
  formatDate,
  SOURCE_LABEL,
  emptyEoiForm,
} from './tenderConstants';

const isImage = (url) => /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url || '');

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

// ====================
// EOI FORM
// ====================

const EoiFormModal = ({ open, onClose, onSaved, existing, owners = [] }) => {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(() => (existing ? { ...emptyEoiForm, ...existing } : emptyEoiForm));
  const [mode, setMode] = useState(existing?.attachmentType === 'upload' ? 'upload' : 'link');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Give the EOI a title');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Decide the attachment shape from the chosen mode.
      let payload = { ...form };
      if (mode === 'link') {
        payload = { ...payload, attachmentType: form.attachmentUrl ? 'link' : '', attachmentFileName: '' };
      } else {
        // Upload mode: keep any existing uploaded file unless a new one is chosen.
        if (!file) {
          payload = { ...payload, attachmentType: existing?.attachmentType || '', attachmentUrl: existing?.attachmentUrl || '', attachmentFileName: existing?.attachmentFileName || '' };
        }
      }

      const saved = isEdit
        ? await bdApi.updateEoi(existing._id, payload)
        : await bdApi.addEoi(payload);

      // Two-step attachment: store the file only after the EOI exists.
      let finalRecord = saved;
      if (mode === 'upload' && file) {
        finalRecord = await bdApi.uploadEoiAttachment(saved._id, file);
      }
      onSaved(finalRecord);
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
      size="lg"
      title={isEdit ? 'Edit EOI' : 'New Expression of Interest'}
      description="Spot a notice worth chasing — attach the clipping, screenshot, link or note."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" onClick={submit} type="button" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create EOI'}
          </Button>
        </div>
      }
    >
      <form className="space-y-3" onSubmit={submit}>
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="form-label">EOI title *</label>
            <input type="text" className="form-input" required value={form.title}
              onChange={(e) => set('title', e.target.value)} placeholder="e.g. Health-tech accelerator intake" />
          </div>
          <div>
            <label className="form-label">Reference</label>
            <input type="text" className="form-input" value={form.reference}
              onChange={(e) => set('reference', e.target.value)} placeholder="EOI/2026/007" />
          </div>
          <div>
            <label className="form-label">Issuing authority</label>
            <input type="text" className="form-input" value={form.issuingAuthority}
              onChange={(e) => set('issuingAuthority', e.target.value)} placeholder="Who issued it" />
          </div>
          <div>
            <label className="form-label">Owner</label>
            <input type="text" list="eoi-owners" className="form-input" value={form.owner}
              onChange={(e) => set('owner', e.target.value)} placeholder="Who is accountable" />
            <datalist id="eoi-owners">
              {owners.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div>
            <label className="form-label">Source</label>
            <select className="form-input" value={form.source} onChange={(e) => set('source', e.target.value)}>
              <option value="">Select…</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.source === 'Other' && (
            <div>
              <label className="form-label">Source detail *</label>
              <input type="text" className="form-input" value={form.sourceDetail}
                onChange={(e) => set('sourceDetail', e.target.value)} placeholder="e.g. Partner forwarded email" />
            </div>
          )}
          <div>
            <label className="form-label">Deadline</label>
            <input type="date" className="form-input" value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {EOI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <fieldset className="rounded-xl border border-slate-200 px-4 py-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-navy-700">Attachment</legend>
          <div className="flex gap-4 mb-2">
            {['link', 'upload'].map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input type="radio" name="eoi-attach" checked={mode === m}
                  onChange={() => setMode(m)} className="accent-navy-700" />
                {m === 'link' ? 'Paste a link' : 'Upload image / PDF'}
              </label>
            ))}
          </div>

          {mode === 'link' ? (
            <input type="url" className="form-input" value={form.attachmentUrl}
              onChange={(e) => set('attachmentUrl', e.target.value)} placeholder="https://…" />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-navy-50 file:text-navy-700 file:cursor-pointer hover:file:bg-navy-100" />
              <p className="text-[11px] text-slate-500 mt-1">
                Newspaper clipping, WhatsApp screenshot or PDF. Max 15MB.
                {existing?.attachmentType === 'upload' && !file && ` · Current: ${existing.attachmentFileName || 'file'}`}
              </p>
            </div>
          )}
        </fieldset>

        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows="2" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} placeholder="Why this matters, next step" />
        </div>
      </form>
    </Modal>
  );
};

// ====================
// EOI DETAIL
// ====================

const EoiDetailModal = ({ open, onClose, eoi, onEdit, onDelete, onChanged, onConverted }) => {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Recording the call is the whole point of this list. A Pass without a reason
  // is refused by the API, so the reason box appears the moment Pass is picked.
  const saveDecision = async (value) => {
    if (value === 'Pass' && !reason.trim()) {
      setDecision('Pass');
      setActionError('Say why we are passing — that is what stops this notice being re-argued next month.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      onChanged?.(await bdApi.setEoiDecision(eoi._id, {
        decision: value,
        decisionReason: value === 'Pass' ? reason : eoi.decisionReason,
      }));
      setDecision('');
      setReason('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Promote to a tender, carrying every detail already captured so nobody
  // retypes a reference number or a deadline.
  const convert = async () => {
    setBusy(true);
    setActionError(null);
    try {
      onConverted?.(await bdApi.convertEoiToTender(eoi._id, {}));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!eoi) return null;

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">{formatDate(eoi.deadline)}</span>
      <div className="flex flex-wrap gap-2">
        {confirmDelete ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep</Button>
            <Button variant="danger" onClick={() => onDelete(eoi)}>Delete</Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
            {!eoi.convertedToTender && eoi.decision !== 'Pass' && (
              <Button variant="success" onClick={convert} disabled={busy}>
                ⇪ Convert to tender
              </Button>
            )}
            <Button variant="primary" onClick={() => onEdit(eoi)}>✎ Edit</Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={eoi.title}
      description={`${eoi.reference ? `${eoi.reference} · ` : ''}${eoi.issuingAuthority || ''}`}
      footer={footer}
    >
      {actionError && (
        <div className="px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Bid / no-bid. Most notices should end here as a recorded Pass with a
          reason, so the same one is not re-argued from scratch next month. */}
      {!eoi.convertedToTender && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-navy-900">Do we pursue this?</p>
              <p className="text-xs text-slate-600">
                {eoi.decision === 'Undecided'
                  ? 'Undecided. Recording a Pass is as useful as recording a Pursue.'
                  : `Recorded as ${eoi.decision}${eoi.decidedBy ? ` by ${eoi.decidedBy}` : ''}.`}
              </p>
            </div>
            <div className="flex gap-1.5">
              {['Pursue', 'Pass'].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => (d === 'Pass' ? setDecision('Pass') : saveDecision('Pursue'))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                    eoi.decision === d
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                  }`}
                >
                  {d === 'Pursue' ? '✓ Pursue' : '✕ Pass'}
                </button>
              ))}
            </div>
          </div>

          {decision === 'Pass' && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are we passing? e.g. no in-house experience in this sector"
                className="form-input"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setDecision(''); setActionError(null); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => saveDecision('Pass')} disabled={busy || !reason.trim()}>
                  Record the pass
                </Button>
              </div>
            </div>
          )}

          {eoi.decision === 'Pass' && eoi.decisionReason && decision !== 'Pass' && (
            <p className="text-xs text-slate-600 italic mt-2">“{eoi.decisionReason}”</p>
          )}
        </div>
      )}

      {eoi.convertedToTender && (
        <div className="rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 mb-4 text-xs text-forest-800">
          Converted to the tender <strong>{eoi.convertedToTender.title}</strong>
          {eoi.convertedToTender.reference ? ` (${eoi.convertedToTender.reference})` : ''} — it is tracked on the Tenders tab now.
        </div>
      )}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge label={eoi.status} status={STATUS_BADGE[eoi.status] || 'default'} />
          {eoi.source && <Badge label={SOURCE_LABEL(eoi.source, eoi.sourceDetail)} status="default" />}
        </div>

        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <MetaRow label="Reference">{eoi.reference || '—'}</MetaRow>
          <MetaRow label="Issuing authority">{eoi.issuingAuthority || '—'}</MetaRow>
          <MetaRow label="Source">{SOURCE_LABEL(eoi.source, eoi.sourceDetail)}</MetaRow>
          <MetaRow label="Deadline">{formatDate(eoi.deadline)}</MetaRow>
          <MetaRow label="Status">{eoi.status}</MetaRow>
        </div>

        {eoi.attachmentType === 'upload' && eoi.attachmentUrl ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Attachment</p>
            {isImage(eoi.attachmentUrl) ? (
              <img src={eoi.attachmentUrl} alt={eoi.attachmentFileName || eoi.title}
                className="w-full max-h-80 object-contain rounded-lg bg-slate-50" />
            ) : (
              <a href={eoi.attachmentUrl} target="_blank" rel="noopener noreferrer"
                className="text-navy-700 underline text-sm">
                {eoi.attachmentFileName || 'Open file'} ↗
              </a>
            )}
          </div>
        ) : eoi.attachmentType === 'link' && eoi.attachmentUrl ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Link</p>
            <a href={eoi.attachmentUrl} target="_blank" rel="noopener noreferrer"
              className="text-navy-700 underline text-sm break-all">{eoi.attachmentUrl} ↗</a>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-400">
            No attachment.
          </div>
        )}

        {eoi.notes && (
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{eoi.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export { EoiFormModal, EoiDetailModal };
