import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import ContentRepositoryView from './ContentRepositoryView';
import ContentFormModal from './ContentFormModal';
import ContentDetailModal from './ContentDetailModal';
import { ACCENT_CLASSES, CONTENT_TYPES, formatDate, typeMeta } from './contentConstants';

const TypeCard = ({ type, stats, onOpen }) => {
  const accent = ACCENT_CLASSES[type.accent] || ACCENT_CLASSES.navy;
  const bucket = stats?.perType?.[type.id];

  return (
    <button
      onClick={() => onOpen(type.id)}
      className={`group text-left bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col ${accent.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accent.tile}`} aria-hidden="true">
          {type.icon}
        </span>
        {bucket?.review > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium whitespace-nowrap">
            {bucket.review} to review
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold text-navy-900 mt-3 group-hover:text-navy-700">{type.label}</h3>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">{type.purpose}</p>
      <p className="text-xs text-slate-600 mt-1.5 flex-1">{type.blurb}</p>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-500">
          <strong className="text-navy-900 text-sm">{bucket?.total ?? 0}</strong> item{bucket?.total === 1 ? '' : 's'}
          {bucket?.published > 0 && <span className="text-forest-700"> · {bucket.published} live</span>}
        </span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          👁 {bucket?.views ?? 0} · ↗ {bucket?.usage ?? 0}
        </span>
      </div>
    </button>
  );
};

const StatTile = ({ label, value, tone = 'default' }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
    <p className={`text-xl font-bold ${tone === 'warn' ? 'text-amber-700' : tone === 'danger' ? 'text-red-700' : 'text-navy-900'}`}>
      {value}
    </p>
    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
  </div>
);

const RankedList = ({ title, subtitle, items, emptyText, onOpen, metric }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
    <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
    {items.length === 0 ? (
      <p className="text-xs text-slate-400 py-2">{emptyText}</p>
    ) : (
      <ol className="space-y-1.5">
        {items.map((item, i) => (
          <li key={item._id}>
            <button
              onClick={() => onOpen(item)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
            >
              <span className="shrink-0 w-5 h-5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center">
                {i + 1}
              </span>
              <span aria-hidden="true" className="shrink-0">{typeMeta(item.contentType).icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-navy-900 truncate">{item.title}</span>
                <span className="block text-[11px] text-slate-500 truncate">{typeMeta(item.contentType).label}</span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-500 whitespace-nowrap">{metric(item)}</span>
            </button>
          </li>
        ))}
      </ol>
    )}
  </div>
);

const BlogModule = () => {
  const { currentUser, addNotification } = useDashboard();

  const [activeType, setActiveType] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [assets, setAssets] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [sectors, setSectors] = useState([]);

  const [formState, setFormState] = useState({ open: false, type: null, item: null });
  const [detailItem, setDetailItem] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    bdApi.getContentStats()
      .then((data) => { if (!ignore) { setStats(data); setError(null); } })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setStatsLoading(false); });
    return () => { ignore = true; };
  }, [refreshToken]);

  // Picker sources. Documents come from Reports & Docs so a case study PDF is
  // referenced rather than duplicated.
  useEffect(() => {
    bdApi.getAssetLibrary().then(setAssets).catch(() => setAssets([]));
    bdApi.getContentSectors().then(setSectors).catch(() => setSectors([]));
    bdApi.getDocuments().then(setDocuments).catch(() => setDocuments([]));
  }, [refreshToken]);

  const refresh = () => setRefreshToken((t) => t + 1);

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 4000);
  };

  const openNew = (type) => setFormState({ open: true, type, item: null });
  const openEdit = (item) => { setDetailItem(null); setFormState({ open: true, type: item.contentType, item }); };

  const handleSaved = (saved) => {
    refresh();
    if (detailItem && saved?._id === detailItem._id) setDetailItem(saved);
  };

  const handleDelete = async (item) => {
    try {
      await bdApi.deleteContent(item._id);
      setDetailItem(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  // FAQs get the answer itself on the clipboard — that is what a rep needs
  // mid-call. Everything else gets a shareable deep link.
  const handleCopy = async (item) => {
    const text = item.contentType === 'FAQ'
      ? item.verifiedAnswer
      : item.publicUrl
        || `${window.location.origin}${window.location.pathname}#/content/${item.contentType}/${item._id}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this:', text);
    }
    // Copying an answer or a link *is* the item being used.
    try {
      await bdApi.recordContentUsage(item._id, currentUser);
      refresh();
    } catch { /* a counter must never block the copy */ }
  };

  const handleUse = async (item) => {
    try {
      await bdApi.recordContentUsage(item._id, currentUser);
      refresh();
    } catch { /* never block the download */ }
    if (item.fileUrl) window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
  };

  // Smart integration: push a published article into the social pipeline as a
  // pre-filled scripted entry, so nobody retypes the title and URL.
  const handlePromote = async (item) => {
    if (!currentUser) return setError('Pick who you are in the top bar before promoting.');
    try {
      // Field names map onto the SocialContent schema exactly — `postLink`
      // carries the article URL so the scheduler never needs it retyped.
      await bdApi.addSocialContent({
        platform: 'LinkedIn',
        title: `Promo — ${item.title}`,
        product: item.categorySector || '',
        responsiblePerson: currentUser,
        status: 'Scripted',
        message: item.subtitle || item.description || '',
        interestingSnippet: item.focusKeyword || '',
        postLink: item.publicUrl || '',
        coverImage: item.coverAsset?.fileUrl || '',
      });
      await bdApi.recordContentUsage(item._id, currentUser);
      refresh();
      flash(`"${item.title}" queued in Social Media as a scripted LinkedIn promo.`);
      addNotification(`Article queued for social promotion: ${item.title}`, 'info');
    } catch (err) {
      setError(err.message);
    }
  };

  const openFromStats = async (stub) => {
    try {
      setDetailItem(await bdApi.getContentItem(stub._id));
    } catch (err) {
      setError(err.message);
    }
  };

  const modals = (
    <>
      {formState.open && (
        <ContentFormModal
          open
          onClose={() => setFormState({ open: false, type: null, item: null })}
          onSaved={handleSaved}
          currentUser={currentUser}
          defaultType={formState.type}
          existing={formState.item}
          assets={assets}
          documents={documents}
          sectors={sectors}
        />
      )}
      {detailItem && (
        <ContentDetailModal
          key={detailItem._id}
          open
          onClose={() => setDetailItem(null)}
          item={detailItem}
          currentUser={currentUser}
          onChanged={(updated) => { setDetailItem(updated); refresh(); }}
          onEdit={openEdit}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onUse={handleUse}
          onPromote={handlePromote}
        />
      )}
    </>
  );

  if (activeType) {
    return (
      <>
        <ContentRepositoryView
          contentType={activeType}
          onBack={() => setActiveType(null)}
          currentUser={currentUser}
          onNew={openNew}
          onOpenDetail={setDetailItem}
          onCopy={handleCopy}
          onUse={handleUse}
          refreshToken={refreshToken}
          sectors={sectors}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Blog & Content Engine</h1>
          <p className="text-sm text-slate-600">
            Thought leadership, brand assets, market data, objection handling and social proof — one shared library.
          </p>
        </div>
        <Button variant="primary" onClick={() => openNew('Article')}>+ New content</Button>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {notice && <div className="px-3 py-2 rounded-lg bg-forest-50 border border-forest-200 text-sm text-forest-800">✓ {notice}</div>}
      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Pick who you are in the top bar — everything you file here is attributed to that name.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONTENT_TYPES.map((type) => (
            <TypeCard key={type.id} type={type} stats={stats} onOpen={setActiveType} />
          ))}
        </div>

        <div className="xl:col-span-1 space-y-4">
          {statsLoading || !stats ? (
            [0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-navy-900 mb-3">Editorial pipeline</h3>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Total items" value={stats.totals.items} />
                  <StatTile label="Published" value={stats.totals.published} />
                  <StatTile label="Drafts" value={stats.totals.drafts} />
                  <StatTile label="Awaiting review" value={stats.totals.awaitingReview} tone={stats.totals.awaitingReview > 0 ? 'warn' : 'default'} />
                  <StatTile label="Scheduled" value={stats.totals.scheduled} />
                  <StatTile label="Rights alerts" value={stats.totals.rightsAlerts} tone={stats.totals.rightsAlerts > 0 ? 'danger' : 'default'} />
                </div>
              </div>

              <RankedList
                title="Top performing collateral"
                subtitle="What the team actually opens and reuses."
                items={stats.topPerforming}
                emptyText="No engagement recorded yet."
                onOpen={openFromStats}
                metric={(i) => `👁 ${i.viewCount || 0} · ↗ ${i.downloadOrUsageCount || 0}`}
              />

              {stats.awaitingReview.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-amber-800">⏳ Waiting on a reviewer</h3>
                  <p className="text-xs text-slate-500 mb-3">Anyone on the team can pick these up.</p>
                  <ul className="space-y-1.5">
                    {stats.awaitingReview.map((item) => (
                      <li key={item._id}>
                        <button
                          onClick={() => openFromStats(item)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 text-left cursor-pointer transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-navy-900 truncate">{item.title}</span>
                            <span className="block text-[11px] text-slate-500">
                              {typeMeta(item.contentType).label} · {item.authorOrUploader}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">{formatDate(item.createdAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stats.rightsAlerts.length > 0 && (
                <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-red-800">⚠ Licence expiring or expired</h3>
                  <p className="text-xs text-slate-500 mb-3">Pull these from outbound material until renewed.</p>
                  <ul className="space-y-1.5">
                    {stats.rightsAlerts.map((item) => (
                      <li key={item._id}>
                        <button
                          onClick={() => openFromStats(item)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 text-left cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-medium text-navy-900 truncate min-w-0">{item.title}</span>
                          <span className="shrink-0 text-[11px] text-red-700">{formatDate(item.usageRightsExpiry)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modals}
    </div>
  );
};

export default BlogModule;
