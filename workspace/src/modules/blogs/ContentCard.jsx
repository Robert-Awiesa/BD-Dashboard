import Badge from '../../components/common/Badge';
import { markdownExcerpt } from '../../components/common/markdown';
import {
  RIGHTS_BADGE,
  STATUS_BADGE,
  formatDate,
  isImageAsset,
  isVideoAsset,
  typeMeta,
} from './contentConstants';

// Each type leads with the thing that makes it useful at a glance: an asset
// with its thumbnail, an FAQ with the answer, a case study with the number.
const Preview = ({ item }) => {
  if (item.contentType === 'Asset') {
    if (isImageAsset(item)) {
      return (
        <div className="mb-3 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 h-32 flex items-center justify-center">
          <img src={item.fileUrl} alt={item.altText || item.title} className="max-h-full max-w-full object-contain" />
        </div>
      );
    }
    if (isVideoAsset(item)) {
      return (
        <div className="mb-3 rounded-lg bg-slate-900 border border-slate-200 h-32 flex items-center justify-center text-3xl">
          🎬
        </div>
      );
    }
    return null;
  }

  if (item.contentType === 'FAQ') {
    return (
      <p className="text-xs text-slate-700 mt-2 line-clamp-3 bg-slate-50 border-l-2 border-navy-200 pl-2 py-1">
        {item.verifiedAnswer}
      </p>
    );
  }

  if (item.contentType === 'UserStory') {
    return (
      <div className="mt-2 space-y-1">
        {item.quantifiableResults && (
          <p className="text-sm font-bold text-forest-700">📈 {item.quantifiableResults}</p>
        )}
        {item.testimonialQuote && (
          <p className="text-xs text-slate-600 italic line-clamp-2">“{item.testimonialQuote}”</p>
        )}
      </div>
    );
  }

  if (item.contentType === 'Survey' && item.keyTakeaways?.length > 0) {
    return (
      <ul className="mt-2 space-y-0.5">
        {item.keyTakeaways.slice(0, 2).map((t, i) => (
          <li key={i} className="text-xs text-slate-600 line-clamp-1">• {t}</li>
        ))}
        {item.keyTakeaways.length > 2 && (
          <li className="text-[11px] text-slate-400">+{item.keyTakeaways.length - 2} more</li>
        )}
      </ul>
    );
  }

  const excerpt = item.description || markdownExcerpt(item.contentBody, 130);
  return excerpt ? <p className="text-xs text-slate-600 mt-2 line-clamp-2">{excerpt}</p> : null;
};

const ContentCard = ({ item, onOpen, onCopy, onUse, copied }) => {
  const meta = typeMeta(item.contentType);

  return (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-navy-300 transition-all flex flex-col">
      <Preview item={item} />

      <div className="flex items-start gap-2">
        <span className="shrink-0 text-lg leading-none mt-0.5" aria-hidden="true">{meta.icon}</span>
        <button onClick={() => onOpen(item)} className="text-left flex-1 min-w-0 cursor-pointer">
          <h4 className="text-sm font-semibold text-navy-900 group-hover:text-navy-700 line-clamp-2">
            {item.title}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {item.authorOrUploader} · {formatDate(item.createdAt)}
            {item.categorySector ? ` · ${item.categorySector}` : ''}
          </p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <Badge label={item.status} status={STATUS_BADGE[item.status]} />
        {item.contentType === 'Asset' && item.rightsStatus !== 'Unrestricted' && (
          <Badge label={item.rightsStatus} status={RIGHTS_BADGE[item.rightsStatus]} />
        )}
        {item.contentType === 'FAQ' && item.objectionCategory && (
          <Badge label={item.objectionCategory} status="active" />
        )}
        {item.contentType === 'Survey' && (
          <Badge
            label={item.leadMagnetStatus}
            status={item.leadMagnetStatus === 'Public Release' ? 'success' : 'cold'}
          />
        )}
      </div>

      {item.contentType !== 'Asset' && item.contentType !== 'FAQ' && (
        <div className="flex-1" />
      )}

      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-navy-50 text-navy-700 text-[11px]">#{tag}</span>
          ))}
          {item.tags.length > 3 && <span className="text-[11px] text-slate-400">+{item.tags.length - 3}</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <span title="Views">👁 {item.viewCount || 0}</span>
          <span title="Times used">↗ {item.downloadOrUsageCount || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopy(item)}
            title={item.contentType === 'FAQ' ? 'Copy the answer' : 'Copy shareable link'}
            className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-navy-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            {copied ? '✓ Copied' : item.contentType === 'FAQ' ? '📋 Answer' : '🔗 Copy'}
          </button>
          {item.contentType === 'Asset' && (
            <button
              onClick={() => onUse(item)}
              title="Download"
              className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-navy-800 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              ⬇
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentCard;
