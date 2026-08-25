import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { renderMarkdown } from '../../components/common/markdown';
import {
  RIGHTS_BADGE,
  STATUS_BADGE,
  STATUSES,
  formatDate,
  isImageAsset,
  isVideoAsset,
  typeMeta,
} from './contentConstants';

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const Narrative = ({ label, body, tone = 'slate' }) => {
  if (!body) return null;
  const tones = {
    slate: 'border-slate-200',
    forest: 'border-forest-300 bg-forest-50',
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{body}</p>
    </div>
  );
};

const ContentDetailModal = ({
  open, onClose, item, currentUser, onChanged, onEdit, onDelete, onCopy, onUse, onPromote,
}) => {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  if (!item) return null;
  const meta = typeMeta(item.contentType);

  // Status is the shared progress signal in an open workspace, so it is
  // changeable straight from the detail view rather than buried in the form.
  const changeStatus = async (status) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await bdApi.updateContent(item._id, { status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    try {
      onChanged(await bdApi.setContentArchived(item._id, !item.archived));
      setConfirmDelete(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onCopy(item)}>
          {item.contentType === 'FAQ' ? '📋 Copy answer' : '🔗 Copy link'}
        </Button>
        {item.contentType === 'Asset' && (
          <Button variant="secondary" onClick={() => onUse(item)}>⬇ Download</Button>
        )}
        {item.contentType === 'Article' && item.status === 'Published' && item.publicUrl && (
          <Button variant="success" onClick={() => onPromote(item)}>📢 Promote on social</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={toggleArchive}>
          {item.archived ? '↩ Restore' : '🗄 Archive'}
        </Button>
        {item.archived && !confirmDelete && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete permanently</Button>
        )}
        <Button variant="primary" onClick={() => onEdit(item)}>✎ Edit</Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={item.title}
      description={`${meta.label} · ${meta.purpose}`}
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {/* Status workflow — the team's shared progress indicator */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={busy || s === item.status}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  s === item.status
                    ? 'bg-navy-700 text-white border-navy-700 cursor-default'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400 hover:text-navy-800 cursor-pointer'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.archived && <Badge label="Archived" status="cold" />}
          <Badge label={item.status} status={STATUS_BADGE[item.status]} />
          {item.contentType === 'Asset' && item.rightsStatus !== 'Unrestricted' && (
            <Badge label={item.rightsStatus} status={RIGHTS_BADGE[item.rightsStatus]} />
          )}
          {item.contentType === 'Survey' && (
            <Badge label={item.leadMagnetStatus} status={item.leadMagnetStatus === 'Public Release' ? 'success' : 'cold'} />
          )}
        </div>

        {item.rightsStatus === 'Rights Expired' && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            The licence on this asset expired on <strong>{formatDate(item.usageRightsExpiry)}</strong>.
            Stop using it in outbound material until the licence is renewed.
          </div>
        )}

        {confirmDelete && (
          <div className="px-3 py-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
            <p className="text-xs text-red-800">
              This permanently destroys <strong>{item.title}</strong>. It cannot be undone,
              and anyone on the team can do this — type the title to confirm.
            </p>
            <input
              type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={item.title} className="form-input"
              aria-label="Type the title to confirm deletion"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setConfirmDelete(false); setDeleteInput(''); }}>Keep it</Button>
              <Button
                variant="danger" disabled={deleteInput.trim() !== item.title}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => onDelete(item)}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{item.viewCount || 0}</p>
            <p className="text-[11px] text-slate-500">👁 Views</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{item.downloadOrUsageCount || 0}</p>
            <p className="text-[11px] text-slate-500">↗ Times used</p>
          </div>
        </div>

        {/* ---- Type-specific body ---- */}
        {item.contentType === 'Asset' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-center min-h-[10rem]">
            {isImageAsset(item) ? (
              <img src={item.fileUrl} alt={item.altText || item.title} className="max-h-64 max-w-full object-contain" />
            ) : isVideoAsset(item) ? (
              <video src={item.fileUrl} controls className="max-h-64 max-w-full rounded" />
            ) : (
              <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-navy-700 underline">
                Open {item.fileName || 'file'}
              </a>
            )}
          </div>
        )}

        {item.contentType === 'FAQ' && (
          <div className="rounded-lg border-l-3 border-navy-400 bg-navy-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-600">Verified answer</p>
            <p className="text-sm text-navy-900 mt-1 whitespace-pre-wrap">{item.verifiedAnswer}</p>
          </div>
        )}

        {item.contentType === 'Survey' && item.keyTakeaways?.length > 0 && (
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Key takeaways</p>
            <ul className="space-y-1.5">
              {item.keyTakeaways.map((t, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-navy-400">▸</span>{t}
                </li>
              ))}
            </ul>
            {item.infographicUrl && (
              <img src={item.infographicUrl} alt="Survey infographic" className="mt-3 max-h-64 rounded border border-slate-200" />
            )}
          </div>
        )}

        {item.contentType === 'UserStory' && (
          <div className="space-y-2">
            <Narrative label="The challenge" body={item.challenge} />
            <Narrative label="The solution" body={item.solution} />
            {item.quantifiableResults && (
              <Narrative label="Quantifiable results" body={item.quantifiableResults} tone="forest" />
            )}
            {item.testimonialQuote && (
              <blockquote className="border-l-3 border-navy-300 pl-3 py-1 text-sm text-slate-700 italic">
                “{item.testimonialQuote}”
                {item.clientName && <footer className="text-xs text-slate-500 not-italic mt-1">— {item.clientName}</footer>}
              </blockquote>
            )}
          </div>
        )}

        {item.contentBody && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(item.contentBody) }} />
          </div>
        )}

        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-200 text-xs">#{tag}</span>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <MetaRow label="Type">{meta.label}</MetaRow>
          <MetaRow label="Filed by">{item.authorOrUploader}</MetaRow>
          <MetaRow label="Created">{formatDate(item.createdAt)}</MetaRow>
          <MetaRow label="Updated">{formatDate(item.updatedAt)}</MetaRow>
          {item.categorySector && <MetaRow label="Sector">{item.categorySector}</MetaRow>}
          {item.publishedAt && <MetaRow label="Published">{formatDate(item.publishedAt)}</MetaRow>}
          {item.scheduledFor && <MetaRow label="Scheduled for">{formatDate(item.scheduledFor)}</MetaRow>}
          {item.publicUrl && (
            <MetaRow label="Live URL">
              <a href={item.publicUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700 underline break-all">
                {item.publicUrl}
              </a>
            </MetaRow>
          )}
          {/* Each row is scoped to the type that owns the field, so a record
              carrying a stale value from another type can never surface it. */}
          {item.contentType === 'Article' && item.focusKeyword && (
            <MetaRow label="Focus keyword">{item.focusKeyword}</MetaRow>
          )}
          {item.contentType === 'Asset' && (
            <>
              {item.assetCategory && <MetaRow label="Asset category">{item.assetCategory}</MetaRow>}
              {item.dimensions && <MetaRow label="Dimensions">{item.dimensions}</MetaRow>}
              {item.altText && <MetaRow label="Alt text">{item.altText}</MetaRow>}
              {item.usageRights && <MetaRow label="Usage rights">{item.usageRights}</MetaRow>}
              {item.usageRightsExpiry && <MetaRow label="Licence expires">{formatDate(item.usageRightsExpiry)}</MetaRow>}
            </>
          )}
          {item.contentType === 'Survey' && (
            <>
              {item.targetAudience && <MetaRow label="Audience">{item.targetAudience}</MetaRow>}
              {item.sampleSize && <MetaRow label="Sample size">{item.sampleSize}</MetaRow>}
            </>
          )}
          {item.contentType === 'FAQ' && (
            <>
              {item.objectionCategory && <MetaRow label="Objection type">{item.objectionCategory}</MetaRow>}
              {item.associatedProduct && <MetaRow label="Product">{item.associatedProduct}</MetaRow>}
            </>
          )}
          {item.contentType === 'UserStory' && item.clientName && (
            <MetaRow label="Client">{item.clientName}</MetaRow>
          )}
          {item.coverAsset && <MetaRow label="Cover image">{item.coverAsset.title}</MetaRow>}
          {item.clientLogo && <MetaRow label="Client logo">{item.clientLogo.title}</MetaRow>}
          {item.caseStudyDoc && (
            <MetaRow label="Case study PDF">
              <a href={item.caseStudyDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-navy-700 underline">
                {item.caseStudyDoc.title} ↗
              </a>
            </MetaRow>
          )}
          {item.lastUsedAt && (
            <MetaRow label="Last used">
              {formatDate(item.lastUsedAt)}{item.lastUsedBy ? ` by ${item.lastUsedBy}` : ''}
            </MetaRow>
          )}
        </div>

        {!currentUser && (
          <p className="text-xs text-amber-700">
            Pick who you are in the top bar so your edits are attributed.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ContentDetailModal;
