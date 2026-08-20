import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import ContentCard from './ContentCard';
import {
  OBJECTION_CATEGORIES,
  SORT_OPTIONS,
  STATUSES,
  typeMeta,
} from './contentConstants';

const ContentRepositoryView = ({
  contentType,
  onBack,
  currentUser,
  onNew,
  onOpenDetail,
  onCopy,
  onUse,
  refreshToken,
  sectors = [],
}) => {
  const meta = typeMeta(contentType);
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [status, setStatus] = useState('');
  const [sector, setSector] = useState('');
  const [objection, setObjection] = useState('');
  const [sort, setSort] = useState('recent');
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getContentList({
        contentType,
        search: debouncedSearch,
        tag: activeTag,
        status,
        categorySector: sector,
        objectionCategory: objection,
        sort,
        includeArchived: includeArchived ? 'true' : '',
      }),
      bdApi.getContentTags(contentType),
    ])
      .then(([list, tagList]) => {
        if (ignore) return;
        setItems(list);
        setTags(tagList);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [contentType, debouncedSearch, activeTag, status, sector, objection, sort, includeArchived, refreshToken]);

  const handleCopy = async (item) => {
    await onCopy(item);
    setCopiedId(item._id);
    setTimeout(() => setCopiedId((id) => (id === item._id ? null : id)), 1800);
  };

  const openDetail = async (item) => {
    try {
      const updated = await bdApi.recordContentView(item._id, currentUser);
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, ...updated } : i)));
      onOpenDetail({ ...item, ...updated });
    } catch {
      onOpenDetail(item);
    }
  };

  const resetFilters = () => {
    setSearch(''); setActiveTag(''); setStatus('');
    setSector(''); setObjection(''); setSort('recent'); setIncludeArchived(false);
  };

  const filtersActive = Boolean(
    search || activeTag || status || sector || objection || includeArchived || sort !== 'recent'
  );

  // Sector matters for Articles and User Stories; objection type only for FAQs.
  const showSector = contentType === 'Article' || contentType === 'UserStory';
  const showObjection = contentType === 'FAQ';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onBack} className="text-xs font-medium text-slate-500 hover:text-navy-800 cursor-pointer mb-1">
            ← All content
          </button>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span aria-hidden="true">{meta.icon}</span> {meta.label}
          </h1>
          <p className="text-sm text-slate-600">{meta.blurb}</p>
        </div>
        <Button variant="primary" onClick={() => onNew(contentType)}>
          + New {meta.label.replace(/s$/, '')}
        </Button>
      </div>

      {/* Grid-based filter bar: `.form-input` forces width:100% on real controls,
          so cells do the sizing rather than width utilities that would lose. */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={showObjection ? 'Search objections and answers…' : 'Search title, body, author or tag…'}
            className="form-input sm:col-span-2"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input text-sm">
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap px-1">
            <input
              type="checkbox" checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-navy-700 cursor-pointer"
            />
            Show archived
          </label>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input text-sm">
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {showSector && (
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="form-input text-sm">
              <option value="">Any sector</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {showObjection && (
            <select value={objection} onChange={(e) => setObjection(e.target.value)} className="form-input text-sm">
              <option value="">Any objection type</option>
              {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div className="flex items-center">
            {filtersActive && (
              <button onClick={resetFilters} className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-700 cursor-pointer">
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
                  activeTag === tag ? 'bg-navy-700 text-white border-navy-700' : 'border-slate-300 text-slate-600 hover:border-navy-300'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-3xl mb-2" aria-hidden="true">{meta.icon}</p>
          <h3 className="text-base font-semibold text-navy-900">
            {filtersActive ? 'Nothing matches those filters' : `No ${meta.label.toLowerCase()} yet`}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {filtersActive ? 'Try widening the search or clearing a filter.' : meta.purpose}
          </p>
          {!filtersActive && (
            <div className="flex justify-center mt-4">
              <Button variant="primary" onClick={() => onNew(contentType)}>
                + New {meta.label.replace(/s$/, '')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <ContentCard
              key={item._id}
              item={item}
              copied={copiedId === item._id}
              onOpen={openDetail}
              onCopy={handleCopy}
              onUse={onUse}
            />
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="text-xs text-slate-500">
          {items.length} item{items.length === 1 ? '' : 's'}
          {filtersActive ? ' matching your filters' : ` in ${meta.label}`}.
        </p>
      )}
    </div>
  );
};

export default ContentRepositoryView;
