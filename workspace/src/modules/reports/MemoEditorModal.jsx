import { useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import { renderMarkdown } from '../../components/common/markdown';
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_NOTE,
  MEMO_CATEGORIES,
  REVIEW_PRESETS,
  dateFromMonthsAhead,
  defaultReviewDateFor,
  emptyMemoForm,
  toDateInput,
} from './documentConstants';

// Toolbar actions wrap or prefix the current selection. Kept to the formatting
// the memo spec calls for — bold, headings, lists, bullets — rather than a
// full WYSIWYG surface.
const TOOLBAR = [
  { label: 'B', title: 'Bold', wrap: '**', className: 'font-bold' },
  { label: 'I', title: 'Italic', wrap: '*', className: 'italic' },
  { label: 'H2', title: 'Heading', prefix: '## ' },
  { label: 'H3', title: 'Sub-heading', prefix: '### ' },
  { label: '• List', title: 'Bulleted list', prefix: '- ' },
  { label: '1. List', title: 'Numbered list', prefix: '1. ' },
  { label: '❝', title: 'Quote', prefix: '> ' },
  { label: '🔗', title: 'Link', wrap: null, insert: '[label](https://)' },
];

const MemoEditorModal = ({
  open,
  onClose,
  onSaved,
  currentUser,
  defaultCategory,
  campaigns = [],
  events = [],
  existingDoc = null,
}) => {
  const isEditing = Boolean(existingDoc);

  // Seeded once per mount; the call site keys this component by document id so
  // opening a different memo remounts it with that memo's text.
  const [form, setForm] = useState(() => {
    if (existingDoc) {
      return {
        title: existingDoc.title,
        category: existingDoc.category,
        body: existingDoc.body || '',
        description: existingDoc.description || '',
        accessLevel: existingDoc.accessLevel,
        publishStatus: existingDoc.publishStatus || 'Draft',
        reviewDate: toDateInput(existingDoc.reviewDate),
        tags: existingDoc.tags || [],
        linkedCampaign: existingDoc.linkedCampaign?._id || '',
        linkedEvent: existingDoc.linkedEvent?._id || '',
      };
    }
    const category = MEMO_CATEGORIES.includes(defaultCategory) ? defaultCategory : MEMO_CATEGORIES[0];
    // Talking points go stale; a memo records a decision at a point in time and
    // becomes history instead, so only the former is pre-dated.
    return { ...emptyMemoForm, category, reviewDate: defaultReviewDateFor(category) };
  });
  const [reviewDateTouched, setReviewDateTouched] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Applies a toolbar action to the current selection and restores the caret,
  // so formatting never yanks the user out of their place in the document.
  const applyFormat = (action) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    let replacement;
    let caretOffset;

    if (action.insert) {
      replacement = action.insert;
      caretOffset = action.insert.length;
    } else if (action.wrap) {
      replacement = `${action.wrap}${selected || action.title}${action.wrap}`;
      caretOffset = replacement.length;
    } else {
      // Prefix every line in the selection, so highlighting three lines and
      // hitting "• List" produces three bullets rather than one.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end) || action.title;
      replacement = block
        .split('\n')
        .map((line) => (line.startsWith(action.prefix) ? line : action.prefix + line))
        .join('\n');
      const next = value.slice(0, lineStart) + replacement + value.slice(end);
      setForm((f) => ({ ...f, body: next }));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart + replacement.length, lineStart + replacement.length);
      });
      return;
    }

    const next = value.slice(0, start) + replacement + value.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + caretOffset, start + caretOffset);
    });
  };

  const applyPreset = (months) => {
    setReviewDateTouched(true);
    setForm((f) => ({ ...f, reviewDate: dateFromMonthsAhead(months) }));
  };

  const save = async (publishStatus) => {
    setError(null);
    if (!form.title.trim()) return setError('A memo title is required.');
    if (!form.body.trim()) return setError('Write something before saving.');
    if (!currentUser) return setError('Pick who you are in the top bar before saving.');

    setSubmitting(true);
    try {
      let saved;
      if (isEditing) {
        // Every save on an existing memo snapshots the previous text, so the
        // edit history is the version history — no separate draft store.
        saved = await bdApi.addDocumentVersion(existingDoc._id, {
          body: form.body,
          publishStatus,
          description: form.description,
          reviewDate: form.reviewDate,
          changeNote,
          savedBy: currentUser,
        });
        // Metadata that lives outside the version snapshot.
        saved = await bdApi.updateDocument(existingDoc._id, {
          title: form.title,
          category: form.category,
          accessLevel: form.accessLevel,
          tags: form.tags,
          linkedCampaign: form.linkedCampaign,
          linkedEvent: form.linkedEvent,
        });
      } else {
        saved = await bdApi.addDocument({
          ...form,
          kind: 'memo',
          publishStatus,
          uploadedBy: currentUser,
          linkedCampaign: form.linkedCampaign || undefined,
          linkedEvent: form.linkedEvent || undefined,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        Authored by <strong className="text-navy-800">{currentUser || '—'}</strong>
        {isEditing && ` · editing v${existingDoc.version}`}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" onClick={() => save('Draft')} disabled={submitting}>
          Save as draft
        </Button>
        <Button variant="primary" onClick={() => save('Published')} disabled={submitting}>
          {submitting ? 'Saving…' : 'Publish'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEditing ? `Edit memo — ${existingDoc?.title}` : 'Create live memo'}
      description="Write and publish directly in the workspace — no external editor, no file to upload."
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Memo title <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={update('title')}
              placeholder="Enterprise objection handling"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Category</label>
            <select
              value={form.category}
              onChange={(e) => {
                const category = e.target.value;
                setForm((f) => ({
                  ...f,
                  category,
                  reviewDate: reviewDateTouched ? f.reviewDate : defaultReviewDateFor(category),
                }));
              }}
              className="form-input"
            >
              {MEMO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Author</label>
            <input type="text" value={currentUser || ''} readOnly className="form-input" />
          </div>
          <div>
            <label className="form-label">Access level</label>
            <select value={form.accessLevel} onChange={update('accessLevel')} className="form-input">
              {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">{ACCESS_LEVEL_NOTE}</p>
          </div>
        </div>

        {/* --- Editor --- */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label mb-0">Memo body <span className="text-red-600">*</span></label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs font-medium text-navy-700 hover:text-navy-900 cursor-pointer"
            >
              {showPreview ? '✎ Back to editing' : '👁 Preview'}
            </button>
          </div>

          {showPreview ? (
            <div className="min-h-[16rem] rounded-lg border border-slate-200 bg-white px-4 py-3">
              {form.body.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(form.body) }} />
              ) : (
                <p className="text-sm text-slate-400">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-300 overflow-hidden focus-within:border-navy-700 focus-within:shadow-[0_0_0_3px_var(--color-primary-glow)] transition-all">
              <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                {TOOLBAR.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    title={action.title}
                    onClick={() => applyFormat(action)}
                    className={`px-2 py-1 text-xs rounded-md text-slate-700 hover:bg-white hover:text-navy-900 border border-transparent hover:border-slate-300 cursor-pointer transition-colors ${action.className || ''}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={form.body}
                onChange={update('body')}
                rows={14}
                placeholder={'## Pricing pushback\n\n- Anchor on **total cost of ownership**\n- Offer the pilot tier'}
                className="w-full px-4 py-3 text-sm font-mono leading-relaxed text-navy-900 border-none outline-none resize-y"
              />
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Markdown supported: <code>##</code> headings, <code>**bold**</code>, <code>*italic*</code>,
            {' '}<code>-</code> bullets, <code>1.</code> numbers, <code>&gt;</code> quotes, <code>[link](url)</code>.
          </p>
        </div>

        {isEditing && (
          <div>
            <label className="form-label">What changed?</label>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Added the security-review section"
              className="form-input"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Short description</label>
            <input
              type="text"
              value={form.description}
              onChange={update('description')}
              placeholder="One line for the repository card"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Review / expiry date</label>
            <input
              type="date"
              value={form.reviewDate}
              onChange={(e) => { setReviewDateTouched(true); setForm((f) => ({ ...f, reviewDate: e.target.value })); }}
              className="form-input"
            />
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
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">Tags</label>
          <TagInput
            value={form.tags}
            onChange={(tags) => setForm((f) => ({ ...f, tags }))}
            placeholder="Enterprise, Objections, Pricing…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-navy-900">Link to active work (optional)</p>
          </div>
          <div>
            <label className="form-label">Campaign</label>
            <select value={form.linkedCampaign} onChange={update('linkedCampaign')} className="form-input">
              <option value="">— none —</option>
              {campaigns.map((c) => <option key={c._id} value={c._id}>{c.campaignName}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Event</label>
            <select value={form.linkedEvent} onChange={update('linkedEvent')} className="form-input">
              <option value="">— none —</option>
              {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.title}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MemoEditorModal;
