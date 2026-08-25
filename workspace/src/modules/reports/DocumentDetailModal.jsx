import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { renderMarkdown } from '../../components/common/markdown';
import {
  ACCESS_BADGE_STATUS,
  REVIEW_BADGE_STATUS,
  fileIconFor,
  formatDate,
} from './documentConstants';

const TABS = [
  { id: 'content', label: 'Content' },
  { id: 'versions', label: 'Versions' },
  { id: 'comments', label: 'Discussion' },
];

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const DocumentDetailModal = ({
  open,
  onClose,
  doc,
  currentUser,
  onChanged,
  onNewVersion,
  onDownload,
  onCopyLink,
  onDelete,
}) => {
  // Keyed by document id at the call site, so switching documents remounts
  // this dialog on the Content tab with an empty comment box.
  const [tab, setTab] = useState('content');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  // Hard delete is a two-step, type-the-title confirmation rather than a
  // window.confirm: the workspace is open to everyone, so there is no owner
  // check between one mis-click and somebody else's whole version history.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  if (!doc) return null;

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (!currentUser) return setError('Pick who you are in the top bar before commenting.');
    setPosting(true);
    setError(null);
    try {
      const updated = await bdApi.addDocumentComment(doc._id, {
        author: currentUser,
        body: comment,
      });
      setComment('');
      onChanged(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (commentId) => {
    try {
      onChanged(await bdApi.deleteDocumentComment(doc._id, commentId));
    } catch (err) {
      setError(err.message);
    }
  };

  // Archiving is reversible and keeps the version history, so it needs no
  // confirmation — it is the intended way out of the active repository.
  const toggleArchive = async () => {
    try {
      onChanged(await bdApi.setDocumentArchived(doc._id, !doc.archived));
      setConfirmDelete(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // Newest first — the history reads as a changelog, not an append log.
  const history = [...(doc.versionHistory || [])].reverse();
  const comments = [...(doc.comments || [])].reverse();

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onCopyLink(doc)}>🔗 Copy link</Button>
        {doc.kind === 'file' && (
          <Button variant="secondary" onClick={() => onDownload(doc)}>⬇ Download</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={toggleArchive}>
          {doc.archived ? '↩ Restore' : '🗄 Archive'}
        </Button>
        {/* Permanent deletion is only offered once a document is archived —
            you cannot reach it in one step from the active repository. */}
        {doc.archived && !confirmDelete && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete permanently</Button>
        )}
        <Button variant="primary" onClick={() => onNewVersion(doc)}>
          {doc.kind === 'memo' ? '✎ Edit memo' : '⭱ New version'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={doc.title}
      description={`${doc.category} · v${doc.version} · ${doc.kind === 'memo' ? 'Live memo' : doc.fileType || 'File'}`}
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Status strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          {doc.kind === 'memo' && <Badge label="Live memo" status="Demo" />}
          {doc.publishStatus === 'Draft' && <Badge label="Draft" status="ongoing" />}
          {doc.archived && <Badge label="Archived" status="cold" />}
          {/* `reviewStatus` collapses to 'Archived' once archived, which would
              duplicate the badge above — review state only matters while live. */}
          {!doc.archived && doc.reviewStatus !== 'No Review Date' && (
            <Badge label={doc.reviewStatus} status={REVIEW_BADGE_STATUS[doc.reviewStatus]} />
          )}
          <Badge label={doc.accessLevel} status={ACCESS_BADGE_STATUS[doc.accessLevel]} />
        </div>

        {doc.archived && !confirmDelete && (
          <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-700">
            Archived — hidden from the active repository, but the file and its full
            version history are intact. Restore it any time.
          </div>
        )}

        {confirmDelete && (
          <div className="px-3 py-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
            <p className="text-xs text-red-800">
              This permanently destroys <strong>{doc.title}</strong>, its{' '}
              {(doc.versionHistory?.length || 0) + 1} version(s) and{' '}
              {doc.comments?.length || 0} comment(s). It cannot be undone, and anyone
              on the team can do this — so type the title to confirm you mean it.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={doc.title}
              className="form-input"
              aria-label="Type the document title to confirm deletion"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => { setConfirmDelete(false); setDeleteInput(''); }}
              >
                Keep it
              </Button>
              <Button
                variant="danger"
                disabled={deleteInput.trim() !== doc.title}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => onDelete(doc)}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        )}

        {doc.reviewStatus === 'Review Needed' && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            This document passed its review date on <strong>{formatDate(doc.reviewDate)}</strong>.
            {' '}<strong>{doc.uploadedBy}</strong> has been reminded to publish a refresh or archive it.
          </div>
        )}

        {/* Engagement (Feature 4) */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Views', value: doc.viewCount || 0, icon: '👁' },
            { label: 'Downloads', value: doc.downloadCount || 0, icon: '⬇' },
            { label: 'Versions', value: (doc.versionHistory?.length || 0) + 1, icon: '🗂' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-navy-900">{stat.value}</p>
              <p className="text-[11px] text-slate-500">{stat.icon} {stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
                tab === t.id
                  ? 'border-navy-700 text-navy-900'
                  : 'border-transparent text-slate-500 hover:text-navy-700'
              }`}
            >
              {t.label}
              {t.id === 'comments' && comments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{comments.length}</span>
              )}
              {t.id === 'versions' && history.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{history.length + 1}</span>
              )}
            </button>
          ))}
        </div>

        {/* --- Content tab --- */}
        {tab === 'content' && (
          <div className="space-y-4">
            {doc.description && (
              <p className="text-sm text-slate-700">{doc.description}</p>
            )}

            {doc.kind === 'memo' ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body) }} />
              </div>
            ) : (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onDownload(doc, { openOnly: true })}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:border-navy-300 hover:bg-white transition-colors"
              >
                <span className="text-2xl" aria-hidden="true">{fileIconFor(doc)}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-900 truncate">
                    {doc.fileName || 'Open document'}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[doc.fileType, doc.fileSize].filter(Boolean).join(' · ')} — opens in a new tab
                  </span>
                </span>
              </a>
            )}

            {doc.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-200 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <MetaRow label="Category">{doc.category}</MetaRow>
              <MetaRow label="Uploaded by">{doc.uploadedBy}</MetaRow>
              {doc.lastEditedBy && doc.lastEditedBy !== doc.uploadedBy && (
                <MetaRow label="Last edited by">{doc.lastEditedBy}</MetaRow>
              )}
              <MetaRow label="Created">{formatDate(doc.createdAt)}</MetaRow>
              <MetaRow label="Updated">{formatDate(doc.updatedAt)}</MetaRow>
              <MetaRow label="Review date">
                {doc.reviewDate ? formatDate(doc.reviewDate) : 'Not set'}
              </MetaRow>
              {doc.lastAccessedAt && (
                <MetaRow label="Last opened">
                  {formatDate(doc.lastAccessedAt)}{doc.lastAccessedBy ? ` by ${doc.lastAccessedBy}` : ''}
                </MetaRow>
              )}
              {doc.linkedCampaign && <MetaRow label="Campaign">{doc.linkedCampaign.campaignName}</MetaRow>}
              {doc.linkedEvent && <MetaRow label="Event">{doc.linkedEvent.title}</MetaRow>}
            </div>
          </div>
        )}

        {/* --- Versions tab --- */}
        {tab === 'versions' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-navy-900">v{doc.version} — current</span>
                <span className="text-[11px] text-slate-600">{formatDate(doc.updatedAt)}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {doc.kind === 'memo' ? `Last edited by ${doc.lastEditedBy || doc.uploadedBy}` : doc.fileName}
              </p>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 px-1 py-2">
                No earlier versions yet. Publishing a revision moves the current
                one here instead of creating a duplicate entry.
              </p>
            ) : (
              history.map((v) => (
                <div key={v._id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">v{v.version}</span>
                    <span className="text-[11px] text-slate-500">{formatDate(v.savedAt)}</span>
                  </div>
                  {v.changeNote && <p className="text-xs text-slate-600 mt-0.5">{v.changeNote}</p>}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">
                      {v.savedBy ? `by ${v.savedBy}` : ''}
                    </span>
                    {v.fileUrl && (
                      <a
                        href={v.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-navy-700 hover:text-navy-900 underline underline-offset-2"
                      >
                        Open {v.fileName || 'file'}
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- Comments tab (Feature 2) --- */}
        {tab === 'comments' && (
          <div className="space-y-3">
            <form onSubmit={postComment} className="space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder={currentUser ? `Comment as ${currentUser}…` : 'Pick who you are in the top bar to comment'}
                className="form-input"
              />
              <div className="flex justify-end">
                <Button variant="primary" type="submit" disabled={posting || !comment.trim()}>
                  {posting ? 'Posting…' : 'Post comment'}
                </Button>
              </div>
            </form>

            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No discussion yet — comments keep feedback attached to the document
                rather than scattered across chat threads.
              </p>
            ) : (
              comments.map((c) => (
                <div key={c._id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-navy-900">{c.author}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{formatDate(c.createdAt)}</span>
                      <button
                        onClick={() => removeComment(c._id)}
                        className="text-[11px] text-slate-400 hover:text-red-700 cursor-pointer"
                        aria-label="Delete comment"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DocumentDetailModal;
