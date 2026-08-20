import { fileIconFor, formatDate } from './documentConstants';

// Feature 4: leadership-facing view of whether the repository is actually
// being used, and what has gone stale. Read-only — every number here is a
// by-product of normal use rather than something anyone has to maintain.

const StatTile = ({ label, value, tone = 'default' }) => {
  const tones = {
    default: 'text-navy-900',
    warn: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
};

const RankedList = ({ title, subtitle, items, emptyText, onOpen, metric }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
    <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
    {items.length === 0 ? (
      <p className="text-xs text-slate-400 py-2">{emptyText}</p>
    ) : (
      <ol className="space-y-1.5">
        {items.map((doc, index) => (
          <li key={doc._id}>
            <button
              onClick={() => onOpen(doc)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
            >
              <span className="shrink-0 w-5 h-5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center">
                {index + 1}
              </span>
              <span className="shrink-0" aria-hidden="true">{fileIconFor(doc)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-navy-900 truncate">{doc.title}</span>
                <span className="block text-[11px] text-slate-500 truncate">{doc.category}</span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-500 whitespace-nowrap">{metric(doc)}</span>
            </button>
          </li>
        ))}
      </ol>
    )}
  </div>
);

const DocumentAnalyticsPanel = ({ stats, onOpenDocument, loading }) => {
  if (loading || !stats) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    );
  }

  const { totals, mostUsed, trending, reviewNeeded } = stats;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-navy-900 mb-3">Repository at a glance</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Documents" value={totals.documents} />
          <StatTile label="Live memos" value={totals.memos} />
          <StatTile label="Total views" value={totals.totalViews} />
          <StatTile label="Downloads" value={totals.totalDownloads} />
          <StatTile label="Unpublished drafts" value={totals.drafts} />
          <StatTile
            label="Review needed"
            value={totals.reviewNeeded}
            tone={totals.reviewNeeded > 0 ? 'warn' : 'default'}
          />
        </div>
      </div>

      <RankedList
        title="Most used resources"
        subtitle="What the team actually opens and downloads."
        items={mostUsed}
        emptyText="No engagement recorded yet — counts start as soon as documents are opened."
        onOpen={onOpenDocument}
        metric={(d) => `👁 ${d.viewCount || 0} · ⬇ ${d.downloadCount || 0}`}
      />

      <RankedList
        title="Trending — last 30 days"
        subtitle="Recently accessed, ranked by pull."
        items={trending}
        emptyText="Nothing opened in the last 30 days."
        onOpen={onOpenDocument}
        metric={(d) => formatDate(d.lastAccessedAt)}
      />

      {reviewNeeded.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-red-800">⚠ Past their review date</h3>
          <p className="text-xs text-slate-500 mb-3">
            The original uploader is reminded weekly until each is refreshed or archived.
          </p>
          <ul className="space-y-1.5">
            {reviewNeeded.map((doc) => (
              <li key={doc._id}>
                <button
                  onClick={() => onOpenDocument(doc)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 text-left cursor-pointer transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-navy-900 truncate">{doc.title}</span>
                    <span className="block text-[11px] text-slate-500">
                      {doc.category} · {doc.uploadedBy}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-red-700 whitespace-nowrap">
                    due {formatDate(doc.reviewDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentAnalyticsPanel;
