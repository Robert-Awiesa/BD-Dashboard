import Badge from '../../components/common/Badge';
import { markdownExcerpt } from '../../components/common/markdown';
import {
  ACCESS_BADGE_STATUS,
  REVIEW_BADGE_STATUS,
  fileIconFor,
  formatDate,
} from './documentConstants';

const IconStat = ({ icon, value, label }) => (
  <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={label}>
    <span aria-hidden="true">{icon}</span>
    {value}
  </span>
);

const DocumentCard = ({ doc, onOpen, onCopyLink, onDownload, onNewVersion, copied }) => {
  const excerpt = doc.kind === 'memo' ? markdownExcerpt(doc.body, 140) : doc.description;
  const linked = doc.linkedCampaign?.campaignName || doc.linkedEvent?.title;

  return (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-navy-300 transition-all flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-2xl leading-none mt-0.5" aria-hidden="true">
          {fileIconFor(doc)}
        </span>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpen(doc)}
            className="text-left w-full cursor-pointer"
          >
            <h4 className="text-sm font-semibold text-navy-900 group-hover:text-navy-700 line-clamp-2">
              {doc.title}
            </h4>
          </button>
          <p className="text-xs text-slate-500 mt-0.5">
            {doc.uploadedBy} · {formatDate(doc.createdAt)}
            {doc.kind === 'file' && doc.fileSize ? ` · ${doc.fileSize}` : ''}
          </p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
          v{doc.version}
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {doc.kind === 'memo' && <Badge label="Live memo" status="Demo" />}
        {doc.publishStatus === 'Draft' && <Badge label="Draft" status="ongoing" />}
        {doc.reviewStatus && doc.reviewStatus !== 'No Review Date' && (
          <Badge label={doc.reviewStatus} status={REVIEW_BADGE_STATUS[doc.reviewStatus]} />
        )}
        <Badge label={doc.accessLevel} status={ACCESS_BADGE_STATUS[doc.accessLevel]} />
      </div>

      {/* Body */}
      {excerpt && (
        <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 flex-1">{excerpt}</p>
      )}

      {doc.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {doc.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-navy-50 text-navy-700 text-[11px]">
              #{tag}
            </span>
          ))}
          {doc.tags.length > 4 && (
            <span className="text-[11px] text-slate-400">+{doc.tags.length - 4}</span>
          )}
        </div>
      )}

      {linked && (
        <p className="text-[11px] text-slate-500 mt-2 truncate" title={linked}>
          🔗 Linked to {linked}
        </p>
      )}

      {/* Footer: engagement + quick actions */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-2.5">
          <IconStat icon="👁" value={doc.viewCount || 0} label="Views" />
          <IconStat icon="⬇" value={doc.downloadCount || 0} label="Downloads" />
          {doc.comments?.length > 0 && (
            <IconStat icon="💬" value={doc.comments.length} label="Comments" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopyLink(doc)}
            title="Copy shareable link"
            className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-navy-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            {copied ? '✓ Copied' : '🔗 Copy'}
          </button>
          {doc.kind === 'file' && (
            <button
              onClick={() => onDownload(doc)}
              title="Download"
              className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-navy-800 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ⬇
            </button>
          )}
          <button
            onClick={() => onNewVersion(doc)}
            title={doc.kind === 'memo' ? 'Edit memo' : 'Upload new version'}
            className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-navy-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            {doc.kind === 'memo' ? '✎' : '⭱'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentCard;
