import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import DocumentCard from './DocumentCard';
import {
  ACCESS_BADGE_STATUS,
  ACCESS_LEVELS,
  REVIEW_BADGE_STATUS,
  REVIEW_STATUSES,
  SORT_OPTIONS,
  categoryMeta,
  fileIconFor,
  formatDate,
} from './documentConstants';

const KIND_FILTERS = [
  { id: '', label: 'All' },
  { id: 'file', label: 'Files' },
  { id: 'memo', label: 'Live memos' },
];

/**
 * Drill-down repository for one category: search, tag and attribute filtering,
 * sorting, and grid/table presentation over the same result set.
 */
const DocumentRepositoryView = ({
  category,
  onBack,
  currentUser,
  onOpenUpload,
  onOpenMemo,
  onOpenDetail,
  refreshToken,
  onMutated,
}) => {
  const meta = categoryMeta(category);
  const [documents, setDocuments] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [layout, setLayout] = useState('grid');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [accessLevel, setAccessLevel] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('recent');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // `ignore` guards against a slow response for stale filters overwriting a
  // newer result — the same pattern the events module uses.
  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getDocuments({
        category,
        search: debouncedSearch,
        tag: activeTag,
        accessLevel,
        reviewStatus,
        kind,
        sort,
        includeArchived: includeArchived ? 'true' : '',
      }),
      bdApi.getDocumentTags(category),
    ])
      .then(([docs, tagList]) => {
        if (ignore) return;
        setDocuments(docs);
        setTags(tagList);
        setError(null);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [
    category, debouncedSearch, activeTag, accessLevel,
    reviewStatus, kind, sort, includeArchived, refreshToken,
  ]);

  // Deep link straight to this document inside the hub, for pasting into chat.
  const copyLink = async (doc) => {
    const url = `${window.location.origin}${window.location.pathname}#/reports/${doc.category}/${doc._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API needs a secure context; fall back to a prompt so the
      // user can still copy the link by hand over plain http.
      window.prompt('Copy this link:', url);
    }
    setCopiedId(doc._id);
    setTimeout(() => setCopiedId((id) => (id === doc._id ? null : id)), 1800);
  };

  // Count the download, then let the browser fetch the file.
  const download = async (doc, options = {}) => {
    try {
      const updated = options.openOnly
        ? await bdApi.recordDocumentView(doc._id, currentUser)
        : await bdApi.recordDocumentDownload(doc._id, currentUser);
      setDocuments((prev) => prev.map((d) => (d._id === doc._id ? { ...d, ...updated } : d)));
      onMutated?.();
    } catch {
      // A failed counter must never block the user getting their file.
    }
    if (!options.openOnly && doc.fileUrl) {
      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const openDetail = async (doc) => {
    try {
      const updated = await bdApi.recordDocumentView(doc._id, currentUser);
      setDocuments((prev) => prev.map((d) => (d._id === doc._id ? { ...d, ...updated } : d)));
      onOpenDetail({ ...doc, ...updated });
      onMutated?.();
    } catch {
      onOpenDetail(doc);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setActiveTag('');
    setAccessLevel('');
    setReviewStatus('');
    setKind('');
    setSort('recent');
    setIncludeArchived(false);
  };

  const filtersActive = Boolean(
    search || activeTag || accessLevel || reviewStatus || kind || includeArchived || sort !== 'recent'
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={onBack}
            className="text-xs font-medium text-slate-500 hover:text-navy-800 cursor-pointer mb-1"
          >
            ← All categories
          </button>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span aria-hidden="true">{meta.icon}</span> {category}
          </h1>
          <p className="text-sm text-slate-600">{meta.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onOpenMemo(category)}>✍ Create live memo</Button>
          <Button variant="primary" onClick={() => onOpenUpload(category)}>⭱ Upload document</Button>
        </div>
      </div>

      {/* Filter bar */}
      {/* A grid rather than a flex row: `.form-input` sets width:100% on real
          controls with higher specificity than any width utility, so the
          controls are sized by their grid cell instead of fighting that rule. */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description, tag or author…"
            className="form-input sm:col-span-2"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input text-sm">
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
              {['grid', 'table'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayout(mode)}
                  title={mode === 'grid' ? 'Card view' : 'Table view'}
                  className={`px-3 text-sm cursor-pointer transition-colors ${
                    layout === mode ? 'bg-navy-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'grid' ? '▦' : '☰'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="accent-navy-700 cursor-pointer"
              />
              Archived
            </label>
          </div>

          <select value={kind} onChange={(e) => setKind(e.target.value)} className="form-input text-sm">
            {KIND_FILTERS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} className="form-input text-sm">
            <option value="">Any access level</option>
            {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="form-input text-sm">
            <option value="">Any review status</option>
            {REVIEW_STATUSES.filter((s) => s !== 'No Review Date').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex items-center">
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-700 cursor-pointer"
              >
                ✕ Reset filters
              </button>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            <button
              onClick={() => setActiveTag('')}
              className={`px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-colors ${
                !activeTag ? 'bg-navy-700 text-white border-navy-700' : 'border-slate-300 text-slate-600 hover:border-navy-300'
              }`}
            >
              All tags
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag((t) => (t === tag ? '' : tag))}
                className={`px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-colors ${
                  activeTag === tag
                    ? 'bg-navy-700 text-white border-navy-700'
                    : 'border-slate-300 text-slate-600 hover:border-navy-300'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-3xl mb-2" aria-hidden="true">{meta.icon}</p>
          <h3 className="text-base font-semibold text-navy-900">
            {filtersActive ? 'Nothing matches those filters' : `No documents in ${category} yet`}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {filtersActive
              ? 'Try widening the search or clearing a filter.'
              : 'Upload a file, or write one directly in the workspace.'}
          </p>
          {!filtersActive && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="secondary" onClick={() => onOpenMemo(category)}>✍ Create live memo</Button>
              <Button variant="primary" onClick={() => onOpenUpload(category)}>⭱ Upload document</Button>
            </div>
          )}
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc._id}
              doc={doc}
              copied={copiedId === doc._id}
              onOpen={openDetail}
              onCopyLink={copyLink}
              onDownload={download}
              onNewVersion={(d) => (d.kind === 'memo' ? onOpenMemo(d.category, d) : onOpenUpload(d.category, d))}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-2.5">Document</th>
                  <th className="px-4 py-2.5">Author</th>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="px-4 py-2.5">Review</th>
                  <th className="px-4 py-2.5">Access</th>
                  <th className="px-4 py-2.5 text-right">Usage</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <button onClick={() => openDetail(doc)} className="flex items-center gap-2 text-left cursor-pointer group">
                        <span aria-hidden="true">{fileIconFor(doc)}</span>
                        <span className="min-w-0">
                          <span className="block font-medium text-navy-900 group-hover:text-navy-700 truncate max-w-[18rem]">
                            {doc.title}
                          </span>
                          <span className="block text-xs text-slate-500">{formatDate(doc.createdAt)}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{doc.uploadedBy}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">v{doc.version}</td>
                    <td className="px-4 py-2.5">
                      {doc.reviewStatus !== 'No Review Date' ? (
                        <Badge label={doc.reviewStatus} status={REVIEW_BADGE_STATUS[doc.reviewStatus]} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={doc.accessLevel} status={ACCESS_BADGE_STATUS[doc.accessLevel]} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                      👁 {doc.viewCount || 0} · ⬇ {doc.downloadCount || 0}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => copyLink(doc)} className="px-1.5 py-1 text-xs text-slate-500 hover:text-navy-800 cursor-pointer" title="Copy link">
                        {copiedId === doc._id ? '✓' : '🔗'}
                      </button>
                      {doc.kind === 'file' && (
                        <button onClick={() => download(doc)} className="px-1.5 py-1 text-xs text-slate-500 hover:text-navy-800 cursor-pointer" title="Download">⬇</button>
                      )}
                      <button
                        onClick={() => (doc.kind === 'memo' ? onOpenMemo(doc.category, doc) : onOpenUpload(doc.category, doc))}
                        className="px-1.5 py-1 text-xs text-slate-500 hover:text-navy-800 cursor-pointer"
                        title={doc.kind === 'memo' ? 'Edit memo' : 'New version'}
                      >
                        {doc.kind === 'memo' ? '✎' : '⭱'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <p className="text-xs text-slate-500">
          {documents.length} document{documents.length === 1 ? '' : 's'}
          {filtersActive ? ' matching your filters' : ` in ${category}`}.
        </p>
      )}
    </div>
  );
};

export default DocumentRepositoryView;
