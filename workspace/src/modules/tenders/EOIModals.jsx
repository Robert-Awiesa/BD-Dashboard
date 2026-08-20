import { useState, useRef } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { bdApi } from '../../context/services/api';
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

const EoiFormModal = ({ open, onClose, onSaved, existing }) => {
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

const EoiDetailModal = ({ open, onClose, eoi, onEdit, onDelete }) => {
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
