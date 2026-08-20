import { useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import { renderMarkdown } from '../../components/common/markdown';
import {
  ACCEPTED_ASSET_EXTENSIONS,
  ASSET_CATEGORIES,
  CONTENT_TYPES,
  LEAD_MAGNET_STATUSES,
  OBJECTION_CATEGORIES,
  STATUSES,
  emptyContentForm,
  isImageAsset,
  pickFieldsForType,
  toDateInput,
  typeMeta,
} from './contentConstants';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="form-label">
      {label} {required && <span className="text-red-600">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);

const isAcceptedFile = (file) => {
  const name = file.name.toLowerCase();
  return ACCEPTED_ASSET_EXTENSIONS.some((ext) => name.endsWith(ext));
};

/**
 * One modal, five shapes. The common fields stay put and the type-specific
 * block swaps out, so the team learns a single form rather than five.
 */
const ContentFormModal = ({
  open,
  onClose,
  onSaved,
  currentUser,
  defaultType,
  existing = null,
  assets = [],
  documents = [],
  sectors = [],
}) => {
  const isEditing = Boolean(existing);

  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyContentForm,
        ...existing,
        tags: existing.tags || [],
        keyTakeaways: (existing.keyTakeaways || []).join('\n'),
        scheduledFor: toDateInput(existing.scheduledFor),
        usageRightsExpiry: toDateInput(existing.usageRightsExpiry),
        coverAsset: existing.coverAsset?._id || '',
        clientLogo: existing.clientLogo?._id || '',
        caseStudyDoc: existing.caseStudyDoc?._id || '',
      };
    }
    return { ...emptyContentForm, contentType: defaultType || 'Article' };
  });
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const type = form.contentType;
  const meta = typeMeta(type);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFile = async (file) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setError(`Unsupported file type. Allowed: ${ACCEPTED_ASSET_EXTENSIONS.join(', ')}`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploaded = await bdApi.uploadAssetFile(file);
      setForm((f) => ({
        ...f,
        ...uploaded,
        title: f.title || uploaded.fileName.replace(/\.[^.]+$/, ''),
      }));
      // Read the intrinsic size straight off the image so nobody has to type it.
      if (/^(png|jpg|jpeg|gif|webp)$/i.test(uploaded.fileType)) {
        const img = new Image();
        img.onload = () =>
          setForm((f) => ({ ...f, dimensions: `${img.naturalWidth}x${img.naturalHeight}px` }));
        img.src = uploaded.fileUrl;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return setError('Set the active team member before saving.');

    setSubmitting(true);
    try {
      // Only the fields this content type owns — see pickFieldsForType.
      const scoped = pickFieldsForType(form);
      const payload = {
        ...scoped,
        authorOrUploader: currentUser,
        // Empty selects must clear a ref on edit, not be cast to an ObjectId.
        ...(('coverAsset' in scoped) && { coverAsset: form.coverAsset || null }),
        ...(('clientLogo' in scoped) && { clientLogo: form.clientLogo || null }),
        ...(('caseStudyDoc' in scoped) && { caseStudyDoc: form.caseStudyDoc || null }),
        ...(('scheduledFor' in scoped) && { scheduledFor: form.scheduledFor || null }),
        ...(('usageRightsExpiry' in scoped) && { usageRightsExpiry: form.usageRightsExpiry || null }),
      };
      const saved = isEditing
        ? await bdApi.updateContent(existing._id, payload)
        : await bdApi.addContent(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const imageAssets = assets.filter(isImageAsset);

  // --- Shared markdown editor, used by Articles and User Stories ---
  const markdownEditor = (label, field, placeholder, required) => (
    <Field label={label} required={required}>
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-medium text-navy-700 hover:text-navy-900 cursor-pointer"
        >
          {showPreview ? '✎ Back to editing' : '👁 Preview'}
        </button>
      </div>
      {showPreview ? (
        <div className="min-h-[12rem] rounded-lg border border-slate-200 bg-white px-4 py-3">
          {form[field]?.trim()
            ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(form[field]) }} />
            : <p className="text-sm text-slate-400">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          value={form[field]}
          onChange={update(field)}
          rows={12}
          placeholder={placeholder}
          className="form-input font-mono leading-relaxed"
        />
      )}
      <p className="text-xs text-slate-500 mt-1">
        Markdown: <code>##</code> headings, <code>**bold**</code>, <code>-</code> bullets,
        {' '}<code>[link](url)</code>.
      </p>
    </Field>
  );

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        {isEditing ? 'Editing' : 'Filed'} by <strong className="text-navy-800">{currentUser || '—'}</strong>
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="content-form" disabled={submitting || uploading}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : `Create ${meta.label.replace(/s$/, '')}`}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEditing ? `Edit — ${existing.title}` : `New ${meta.label.replace(/s$/, '')}`}
      description={meta.purpose}
      footer={footer}
    >
      <form id="content-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Type is fixed once created — the required fields differ per type. */}
        {!isEditing && (
          <Field label="Content type" required>
            <select value={type} onChange={update('contentType')} className="form-input">
              {CONTENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.icon} {t.label} — {t.purpose}</option>
              ))}
            </select>
          </Field>
        )}

        {/* ---------- ARTICLE ---------- */}
        {type === 'Article' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Article title" required>
                <input type="text" value={form.title} onChange={update('title')} className="form-input" placeholder="Ghana FinTech Outlook 2026" />
              </Field>
              <Field label="Subtitle">
                <input type="text" value={form.subtitle} onChange={update('subtitle')} className="form-input" placeholder="What the adoption data says" />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Target industry / sector" hint="Energy, FinTech, Logistics…">
                <input
                  type="text" list="content-sectors" value={form.categorySector}
                  onChange={update('categorySector')} className="form-input" placeholder="FinTech"
                />
              </Field>
              <Field label="Cover image" hint="Picked from the Assets library, so swapping the asset updates every article using it.">
                <select value={form.coverAsset} onChange={update('coverAsset')} className="form-input">
                  <option value="">— none —</option>
                  {imageAssets.map((a) => <option key={a._id} value={a._id}>{a.title}</option>)}
                </select>
              </Field>
            </div>

            {markdownEditor('Article body', 'contentBody', '## Growth drivers\n\n- Mobile money rails\n- Regulatory clarity', true)}

            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold text-navy-900">Search optimisation</p>
              <p className="text-xs text-slate-500 mb-3">Drives how the piece surfaces for inbound search.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Meta title" hint={`${form.metaTitle.length}/60 characters`}>
                    <input type="text" value={form.metaTitle} onChange={update('metaTitle')} className="form-input" maxLength={70} />
                  </Field>
                  <Field label="Focus keyword">
                    <input type="text" value={form.focusKeyword} onChange={update('focusKeyword')} className="form-input" placeholder="ghana fintech" />
                  </Field>
                </div>
                <Field label="Meta description" hint={`${form.metaDescription.length}/160 characters`}>
                  <textarea value={form.metaDescription} onChange={update('metaDescription')} rows={2} className="form-input" maxLength={200} />
                </Field>
                <Field label="Published URL" hint="Pulled into social promos, so the scheduler never needs it retyped.">
                  <input type="url" value={form.publicUrl} onChange={update('publicUrl')} className="form-input" placeholder="https://tgts.africa/blog/…" />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* ---------- ASSET ---------- */}
        {type === 'Asset' && (
          <>
            <Field label="File" required>
              {form.fileUrl ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-forest-200 bg-forest-50">
                  {/^(png|jpg|jpeg|gif|webp|svg)$/i.test(form.fileType) && (
                    <img src={form.fileUrl} alt="" className="w-14 h-14 object-contain rounded bg-white border border-slate-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy-900 truncate">{form.fileName}</p>
                    <p className="text-xs text-slate-600">
                      {[form.fileType, form.fileSize, form.dimensions].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, fileUrl: '', fileName: '', fileType: '', fileSize: '', dimensions: '' }))}
                    className="text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                    dragActive ? 'border-navy-400 bg-navy-50' : 'border-slate-300 hover:border-navy-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-medium text-navy-800">
                    {uploading ? 'Uploading…' : 'Drop an image or video here, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{ACCEPTED_ASSET_EXTENSIONS.join('  ·  ')}</p>
                </div>
              )}
              <input
                ref={fileInputRef} type="file" className="hidden"
                accept={ACCEPTED_ASSET_EXTENSIONS.join(',')}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Asset name" required>
                <input type="text" value={form.title} onChange={update('title')} className="form-input" placeholder="TGTS primary logo — navy" />
              </Field>
              <Field label="Category">
                <select value={form.assetCategory} onChange={update('assetCategory')} className="form-input">
                  {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field
              label="Alt text" required
              hint="Describes the image for screen readers and search engines. Required — it is most of what an asset library is worth."
            >
              <input type="text" value={form.altText} onChange={update('altText')} className="form-input" placeholder="TGTS Africa logo, navy wordmark on white" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Dimensions" hint="Read from the file automatically where possible.">
                <input type="text" value={form.dimensions} onChange={update('dimensions')} className="form-input" placeholder="1920x1080px" />
              </Field>
              <Field label="Usage rights / licence">
                <input type="text" value={form.usageRights} onChange={update('usageRights')} className="form-input" placeholder="Owned — unlimited use" />
              </Field>
            </div>

            <Field
              label="Licence expiry"
              hint="Leave blank for material we own outright. Licensed stock gets flagged as it approaches expiry."
            >
              <input type="date" value={form.usageRightsExpiry} onChange={update('usageRightsExpiry')} className="form-input" />
            </Field>
          </>
        )}

        {/* ---------- SURVEY ---------- */}
        {type === 'Survey' && (
          <>
            <Field label="Survey title" required>
              <input type="text" value={form.title} onChange={update('title')} className="form-input" placeholder="2026 Ghanaian Enterprise Tech Adoption Survey" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Target audience">
                <input type="text" value={form.targetAudience} onChange={update('targetAudience')} className="form-input" placeholder="IT leads at 50+ seat firms" />
              </Field>
              <Field label="Sample size">
                <input type="text" value={form.sampleSize} onChange={update('sampleSize')} className="form-input" placeholder="412 respondents" />
              </Field>
            </div>

            <Field
              label="Key statistical takeaways" required
              hint="One per line. These are what get quoted in articles, carousels and sales decks."
            >
              <textarea
                value={form.keyTakeaways} onChange={update('keyTakeaways')} rows={5}
                className="form-input"
                placeholder={'68% cite integration cost as the top blocker\n41% plan a cloud migration within 12 months'}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Infographic / chart" hint="Pick the graphic from the Assets library.">
                <select value={form.infographicUrl} onChange={update('infographicUrl')} className="form-input">
                  <option value="">— none —</option>
                  {imageAssets.map((a) => <option key={a._id} value={a.fileUrl}>{a.title}</option>)}
                </select>
              </Field>
              <Field label="Lead magnet status" hint="Whether the findings may leave the building.">
                <select value={form.leadMagnetStatus} onChange={update('leadMagnetStatus')} className="form-input">
                  {LEAD_MAGNET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {/* ---------- FAQ ---------- */}
        {type === 'FAQ' && (
          <>
            <Field label="Question / objection" required hint="Word it the way a prospect actually says it.">
              <input type="text" value={form.title} onChange={update('title')} className="form-input" placeholder="How does your pricing scale for small teams?" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Objection category">
                <select value={form.objectionCategory} onChange={update('objectionCategory')} className="form-input">
                  {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Associated product">
                <input type="text" value={form.associatedProduct} onChange={update('associatedProduct')} className="form-input" placeholder="Open Text" />
              </Field>
            </div>

            <Field
              label="Verified answer" required
              hint="Someone will read this aloud on a live call. Keep it short enough to say in one breath."
            >
              <textarea value={form.verifiedAnswer} onChange={update('verifiedAnswer')} rows={5} className="form-input" />
            </Field>
          </>
        )}

        {/* ---------- USER STORY ---------- */}
        {type === 'UserStory' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Story title" required>
                <input type="text" value={form.title} onChange={update('title')} className="form-input" placeholder="St Andrew Hospital Healthcare Digitization" />
              </Field>
              <Field label="Client / project name" required>
                <input type="text" value={form.clientName} onChange={update('clientName')} className="form-input" placeholder="St Andrew Hospital" />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Industry sector" hint="Reps filter by this when pitching a lookalike prospect.">
                <input type="text" list="content-sectors" value={form.categorySector} onChange={update('categorySector')} className="form-input" placeholder="Healthcare" />
              </Field>
              <Field label="Client logo">
                <select value={form.clientLogo} onChange={update('clientLogo')} className="form-input">
                  <option value="">— none —</option>
                  {imageAssets.map((a) => <option key={a._id} value={a._id}>{a.title}</option>)}
                </select>
              </Field>
            </div>

            {/* The narrative arc that makes a case study persuasive. */}
            <Field label="The challenge" required>
              <textarea value={form.challenge} onChange={update('challenge')} rows={3} className="form-input" placeholder="Paper records slowed patient intake to twenty minutes per admission." />
            </Field>
            <Field label="The solution" required>
              <textarea value={form.solution} onChange={update('solution')} rows={3} className="form-input" placeholder="Deployed digital data capture across three intake desks." />
            </Field>
            <Field label="Quantifiable results" hint="Numbers close deals — lead with the measurable change.">
              <input type="text" value={form.quantifiableResults} onChange={update('quantifiableResults')} className="form-input" placeholder="40% faster data collection" />
            </Field>
            <Field label="Testimonial quote">
              <textarea value={form.testimonialQuote} onChange={update('testimonialQuote')} rows={2} className="form-input" placeholder="Intake used to take twenty minutes. Now it takes eight." />
            </Field>

            <Field
              label="Full case study document"
              hint="Linked from Reports & Docs rather than re-uploaded, so there is only ever one copy to keep current."
            >
              <select value={form.caseStudyDoc} onChange={update('caseStudyDoc')} className="form-input">
                <option value="">— none —</option>
                {documents.map((d) => <option key={d._id} value={d._id}>{d.title} ({d.category})</option>)}
              </select>
            </Field>

            {markdownEditor('Extended narrative (optional)', 'contentBody', 'Longer write-up for the published version…')}
          </>
        )}

        {/* ---------- Shared tail ---------- */}
        <div className="pt-3 border-t border-slate-200 space-y-4">
          {type !== 'FAQ' && (
            <Field label="Short description" hint="One line for the repository card.">
              <input type="text" value={form.description} onChange={update('description')} className="form-input" />
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Workflow status" hint="Visible to the whole team — this is how progress is tracked.">
              <select value={form.status} onChange={update('status')} className="form-input">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {form.status === 'Scheduled' && (
              <Field label="Scheduled for" required>
                <input type="date" value={form.scheduledFor} onChange={update('scheduledFor')} className="form-input" />
              </Field>
            )}
          </div>

          <Field label="Tags">
            <TagInput
              value={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="FinTech, Q2, Enterprise…"
            />
          </Field>
        </div>

        {/* Shared sector suggestions for the two free-text sector inputs. */}
        <datalist id="content-sectors">
          {sectors.map((s) => <option key={s} value={s} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default ContentFormModal;
