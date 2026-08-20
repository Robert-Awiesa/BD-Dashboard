import { useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import {
  ACCEPTED_EXTENSIONS,
  ACCESS_LEVELS,
  ACCESS_LEVEL_NOTE,
  CATEGORY_IDS,
  CATEGORY_REVIEW_DEFAULTS,
  REVIEW_PRESETS,
  dateFromMonthsAhead,
  defaultReviewDateFor,
  emptyDocumentForm,
  toDateInput,
} from './documentConstants';

// "1.0" -> "1.1". Mirrors bumpVersion() in Server/services/documentService.js
// so the form can preview the tag the API is about to assign.
const nextVersion = (current) => {
  const raw = String(current || '1.0').trim();
  const dotted = raw.match(/^(\d+)\.(\d+)$/);
  if (dotted) return `${dotted[1]}.${Number(dotted[2]) + 1}`;
  const whole = raw.match(/^(\d+)$/);
  if (whole) return `${whole[1]}.1`;
  return `${raw}.1`;
};

const isAcceptedFile = (file) => {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

/**
 * Two modes on one form:
 *   - create      : a brand-new document in the repository
 *   - new-version : supersede an existing document, archiving the current file
 *                   into its version history instead of creating a duplicate row
 */
const DocumentUploadModal = ({
  open,
  onClose,
  onSaved,
  currentUser,
  defaultCategory,
  campaigns = [],
  events = [],
  existingDoc = null,
}) => {
  const isVersionMode = Boolean(existingDoc);

  // Seeded once per mount. The call site passes a `key` that changes with the
  // target document, so reopening the dialog remounts it with fresh state —
  // the same reset pattern the event wizard uses.
  const [form, setForm] = useState(() => {
    if (existingDoc) {
      // Version mode replaces the artefact; metadata stays put except for the
      // fields that legitimately change with a refresh.
      return {
        ...emptyDocumentForm,
        title: existingDoc.title,
        category: existingDoc.category,
        description: existingDoc.description || '',
        accessLevel: existingDoc.accessLevel,
        version: nextVersion(existingDoc.version),
        reviewDate: toDateInput(existingDoc.reviewDate),
        tags: existingDoc.tags || [],
      };
    }
    const category = defaultCategory || CATEGORY_IDS[0];
    return { ...emptyDocumentForm, category, reviewDate: defaultReviewDateFor(category) };
  });
  // Once the uploader edits the review date themselves, switching category
  // must stop overwriting their choice.
  const [reviewDateTouched, setReviewDateTouched] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [useExternalLink, setUseExternalLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Changing category re-seeds the review window to that category's shelf life,
  // unless the uploader has already set a date by hand.
  const updateCategory = (e) => {
    const category = e.target.value;
    setForm((f) => ({
      ...f,
      category,
      reviewDate: reviewDateTouched ? f.reviewDate : defaultReviewDateFor(category),
    }));
  };

  const updateReviewDate = (e) => {
    setReviewDateTouched(true);
    setForm((f) => ({ ...f, reviewDate: e.target.value }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setError(`Unsupported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const meta = await bdApi.uploadDocumentFile(file);
      setForm((f) => ({
        ...f,
        ...meta,
        // Blank title fields adopt the filename, minus its extension.
        title: f.title || meta.fileName.replace(/\.[^.]+$/, ''),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () =>
    setForm((f) => ({ ...f, fileUrl: '', fileName: '', fileType: '', fileSize: '' }));

  const applyPreset = (months) => {
    setReviewDateTouched(true);
    setForm((f) => ({ ...f, reviewDate: dateFromMonthsAhead(months) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError('A document title is required.');
    if (!form.fileUrl) return setError('Attach a file or paste a document link.');
    if (!currentUser) return setError('Set the active team member before uploading.');

    setSubmitting(true);
    try {
      const saved = isVersionMode
        ? await bdApi.addDocumentVersion(existingDoc._id, {
            fileUrl: form.fileUrl,
            fileName: form.fileName,
            fileType: form.fileType,
            fileSize: form.fileSize,
            version: form.version,
            description: form.description,
            reviewDate: form.reviewDate,
            changeNote,
            savedBy: currentUser,
          })
        : await bdApi.addDocument({
            ...form,
            kind: 'file',
            uploadedBy: currentUser,
            linkedCampaign: form.linkedCampaign || undefined,
            linkedEvent: form.linkedEvent || undefined,
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-end items-center gap-2">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="document-upload-form" disabled={submitting || uploading}>
        {submitting
          ? 'Saving…'
          : isVersionMode
            ? `Publish v${form.version}`
            : 'Save to repository'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isVersionMode ? `Upload new version — ${existingDoc?.title}` : 'Upload document'}
      description={
        isVersionMode
          ? `Replaces the live file. v${existingDoc?.version} is kept in the version history.`
          : 'Add a file to the knowledge repository with the metadata that makes it findable.'
      }
      footer={footer}
    >
      <form id="document-upload-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {isVersionMode && (
          <div className="px-3 py-2 rounded-lg bg-navy-50 border border-navy-200 text-xs text-navy-800">
            Superseding <strong>v{existingDoc.version}</strong>
            {existingDoc.fileName ? ` (${existingDoc.fileName})` : ''} — it stays retrievable from
            the version history rather than cluttering the repository.
          </div>
        )}

        {/* --- File attachment --- */}
        <div>
          <label className="form-label">
            {isVersionMode ? 'Replacement file' : 'File attachment'} <span className="text-red-600">*</span>
          </label>

          {form.fileUrl ? (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-forest-200 bg-forest-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-900 truncate">{form.fileName || form.fileUrl}</p>
                <p className="text-xs text-slate-600">
                  {[form.fileType, form.fileSize].filter(Boolean).join(' · ') || 'External link'}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="shrink-0 text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : useExternalLink ? (
            <input
              type="url"
              value={form.fileUrl}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fileUrl: e.target.value,
                  fileName: e.target.value.split('/').pop() || 'External document',
                  fileType: 'LINK',
                }))
              }
              placeholder="https://sharepoint.com/… or https://drive.google.com/…"
              className="form-input"
            />
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-navy-400 bg-navy-50' : 'border-slate-300 hover:border-navy-300 hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-medium text-navy-800">
                {uploading ? 'Uploading…' : 'Drop a file here, or click to browse'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{ACCEPTED_EXTENSIONS.join('  ·  ')}</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {!form.fileUrl && (
            <button
              type="button"
              onClick={() => setUseExternalLink((v) => !v)}
              className="mt-1.5 text-xs font-medium text-navy-700 hover:text-navy-900 cursor-pointer"
            >
              {useExternalLink
                ? '← Upload a file instead'
                : 'Too large to upload? Register an external link instead →'}
            </button>
          )}
        </div>

        {/* --- Core metadata --- */}
        <div>
          <label className="form-label">Document title <span className="text-red-600">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={update('title')}
            placeholder="Q2 Fintech Market Analysis"
            className="form-input"
            readOnly={isVersionMode}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Category <span className="text-red-600">*</span></label>
            <select
              value={form.category}
              onChange={updateCategory}
              className="form-input"
              disabled={isVersionMode}
            >
              {CATEGORY_IDS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Version number</label>
            <input type="text" value={form.version} onChange={update('version')} className="form-input" />
            <p className="text-xs text-slate-500 mt-1">
              {isVersionMode ? `Auto-incremented from v${existingDoc.version}` : 'Defaults to 1.0'}
            </p>
          </div>
        </div>

        <div>
          <label className="form-label">Description / summary</label>
          <textarea
            value={form.description}
            onChange={update('description')}
            rows={3}
            placeholder="What this document covers, and who it is for."
            className="form-input"
          />
        </div>

        {isVersionMode && (
          <div>
            <label className="form-label">What changed in this version?</label>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Refreshed with July actuals"
              className="form-input"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Access level</label>
            <select value={form.accessLevel} onChange={update('accessLevel')} className="form-input" disabled={isVersionMode}>
              {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">{ACCESS_LEVEL_NOTE}</p>
          </div>
          <div>
            <label className="form-label">Review / expiry date</label>
            <input type="date" value={form.reviewDate} onChange={updateReviewDate} className="form-input" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {REVIEW_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.months)}
                  className="px-2 py-0.5 text-xs rounded-full border border-slate-300 text-slate-600 hover:border-navy-300 hover:text-navy-700 cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
              {form.reviewDate && (
                <button
                  type="button"
                  onClick={() => { setReviewDateTouched(true); setForm((f) => ({ ...f, reviewDate: '' })); }}
                  className="px-2 py-0.5 text-xs rounded-full text-slate-500 hover:text-red-700 cursor-pointer"
                >
                  clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {reviewDateTouched || !CATEGORY_REVIEW_DEFAULTS[form.category]
                ? 'Past this date the document is flagged Review Needed and you are reminded to refresh or archive it.'
                : `Pre-filled to ${CATEGORY_REVIEW_DEFAULTS[form.category]} months — the usual shelf life for ${form.category}. Change or clear it if that does not fit.`}
            </p>
          </div>
        </div>

        {!isVersionMode && (
          <>
            <div>
              <label className="form-label">Tags</label>
              <TagInput
                value={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                placeholder="Q2, Fintech, Internal Policy…"
              />
            </div>

            {/* --- Cross-module linking --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-200">
              <div className="sm:col-span-2 pt-3">
                <p className="text-xs font-semibold text-navy-900">Link to active work (optional)</p>
                <p className="text-xs text-slate-500">
                  Attach this document to a campaign or event so it surfaces where the work happens.
                </p>
              </div>
              <div>
                <label className="form-label">Campaign</label>
                <select value={form.linkedCampaign} onChange={update('linkedCampaign')} className="form-input">
                  <option value="">— none —</option>
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>{c.campaignName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Event</label>
                <select value={form.linkedEvent} onChange={update('linkedEvent')} className="form-input">
                  <option value="">— none —</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>{ev.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">
          Filed by <strong className="text-navy-800">{currentUser || 'nobody — set the active team member first'}</strong>.
          View and download counts are tracked automatically.
        </p>
      </form>
    </Modal>
  );
};

export default DocumentUploadModal;
