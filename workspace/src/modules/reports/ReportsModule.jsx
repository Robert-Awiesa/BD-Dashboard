import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import DocumentRepositoryView from './DocumentRepositoryView';
import DocumentUploadModal from './DocumentUploadModal';
import MemoEditorModal from './MemoEditorModal';
import DocumentDetailModal from './DocumentDetailModal';
import DocumentAnalyticsPanel from './DocumentAnalyticsPanel';
import { ACCENT_CLASSES, CATEGORIES, MEMO_CATEGORIES } from './documentConstants';

// The workspace is open to every team member by design, so this name is not a
// login — it is the attribution attached to uploads, memos and comments, and
// the only accountability the system has. That makes name *consistency* matter:
// a free-text box turns Robert / robert / Rob T. into three different authors
// and quietly breaks author filtering and review ownership. So the picker is
// seeded from everyone already on record, with an explicit path to add someone new.
const ADD_NEW = '__add_new__';

const ActiveMemberField = ({ roster }) => {
  const { currentUser, setCurrentUser } = useDashboard();
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft] = useState('');

  const commitNew = () => {
    const name = draft.trim();
    if (!name) return;
    setCurrentUser(name);
    setDraft('');
    setAddingNew(false);
  };

  // Someone whose name is not yet on any document still needs to appear as the
  // current selection until they file something.
  const options = currentUser && !roster.includes(currentUser)
    ? [currentUser, ...roster]
    : roster;

  if (addingNew || (!currentUser && roster.length === 0)) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitNew()}
          placeholder="Your name"
          className="form-input text-sm"
          autoFocus
        />
        <Button variant="secondary" onClick={commitNew}>Set</Button>
        {roster.length > 0 && (
          <button
            onClick={() => { setAddingNew(false); setDraft(''); }}
            className="text-xs text-slate-500 hover:text-navy-800 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {currentUser && (
        <span className="w-6 h-6 shrink-0 rounded-full bg-navy-700 text-white text-xs font-semibold flex items-center justify-center">
          {currentUser.slice(0, 1).toUpperCase()}
        </span>
      )}
      <select
        value={currentUser || ''}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) setAddingNew(true);
          else setCurrentUser(e.target.value);
        }}
        className="form-input text-sm"
        aria-label="Active team member"
      >
        {!currentUser && <option value="">Who are you?</option>}
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value={ADD_NEW}>+ Add someone new…</option>
      </select>
    </div>
  );
};

const CategoryCard = ({ category, stats, onOpen }) => {
  const accent = ACCENT_CLASSES[category.accent] || ACCENT_CLASSES.navy;
  const bucket = stats?.perCategory?.[category.id];

  return (
    <button
      onClick={() => onOpen(category.id)}
      className={`group text-left bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col ${accent.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accent.tile}`} aria-hidden="true">
          {category.icon}
        </span>
        {bucket?.reviewNeeded > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium whitespace-nowrap">
            {bucket.reviewNeeded} to review
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold text-navy-900 mt-3 group-hover:text-navy-700">
        {category.id}
      </h3>
      <p className="text-xs text-slate-600 mt-1 flex-1">{category.blurb}</p>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-500">
          <strong className="text-navy-900 text-sm">{bucket?.total ?? 0}</strong>
          {' '}document{bucket?.total === 1 ? '' : 's'}
          {bucket?.drafts > 0 && <span className="text-amber-700"> · {bucket.drafts} draft</span>}
        </span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          👁 {bucket?.views ?? 0} · ⬇ {bucket?.downloads ?? 0}
        </span>
      </div>
    </button>
  );
};

const ReportsModule = () => {
  const { currentUser } = useDashboard();

  const [activeCategory, setActiveCategory] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Populate the cross-module link pickers once, at module level.
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [roster, setRoster] = useState([]);

  const [uploadState, setUploadState] = useState({ open: false, category: null, doc: null });
  const [memoState, setMemoState] = useState({ open: false, category: null, doc: null });
  const [detailDoc, setDetailDoc] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    bdApi.getDocumentStats()
      .then((data) => {
        if (ignore) return;
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setStatsLoading(false);
      });
    return () => { ignore = true; };
  }, [refreshToken]);

  useEffect(() => {
    // Link targets and the team roster are optional context — a failure here
    // must not take the repository down with it.
    bdApi.getCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
    bdApi.getEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  // Re-read after each save so a newly-added person joins the roster.
  useEffect(() => {
    bdApi.getDocumentAuthors().then(setRoster).catch(() => setRoster([]));
  }, [refreshToken]);

  const refresh = () => setRefreshToken((t) => t + 1);

  const openUpload = (category, doc = null) => setUploadState({ open: true, category, doc });
  const openMemo = (category, doc = null) => setMemoState({ open: true, category, doc });

  const handleSaved = (saved) => {
    refresh();
    if (detailDoc && saved?._id === detailDoc._id) setDetailDoc(saved);
  };

  const handleDetailChanged = (updated) => {
    setDetailDoc(updated);
    refresh();
  };

  // The detail dialog already collected a typed-title confirmation, and the
  // API refuses to delete anything that is not archived, so no extra prompt here.
  const handleDelete = async (doc) => {
    try {
      await bdApi.deleteDocument(doc._id);
      setDetailDoc(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyLink = async (doc) => {
    const url = `${window.location.origin}${window.location.pathname}#/reports/${doc.category}/${doc._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const recordAndOpen = async (doc, options = {}) => {
    try {
      const updated = options.openOnly
        ? await bdApi.recordDocumentView(doc._id, currentUser)
        : await bdApi.recordDocumentDownload(doc._id, currentUser);
      setDetailDoc((d) => (d && d._id === doc._id ? { ...d, ...updated } : d));
      refresh();
    } catch {
      // Never block the file on a counter failure.
    }
    if (!options.openOnly && doc.fileUrl) {
      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Opening a document from an analytics list needs the full record —
  // the stats endpoint returns a trimmed projection.
  const openFromStats = async (stub) => {
    try {
      setDetailDoc(await bdApi.getDocument(stub._id));
    } catch (err) {
      setError(err.message);
    }
  };

  // Mounted only while open, so each dialog seeds its form from the document
  // it was opened for and never carries state over from the previous one.
  const modals = (
    <>
      {uploadState.open && (
        <DocumentUploadModal
          open
          onClose={() => setUploadState({ open: false, category: null, doc: null })}
          onSaved={handleSaved}
          currentUser={currentUser}
          defaultCategory={uploadState.category}
          existingDoc={uploadState.doc}
          campaigns={campaigns}
          events={events}
        />
      )}
      {memoState.open && (
        <MemoEditorModal
          open
          onClose={() => setMemoState({ open: false, category: null, doc: null })}
          onSaved={handleSaved}
          currentUser={currentUser}
          defaultCategory={memoState.category}
          existingDoc={memoState.doc}
          campaigns={campaigns}
          events={events}
        />
      )}
      {detailDoc && (
        <DocumentDetailModal
          key={detailDoc._id}
          open
          onClose={() => setDetailDoc(null)}
          doc={detailDoc}
          currentUser={currentUser}
          onChanged={handleDetailChanged}
          onCopyLink={copyLink}
          onDownload={recordAndOpen}
          onDelete={handleDelete}
          onNewVersion={(doc) => {
            setDetailDoc(null);
            if (doc.kind === 'memo') openMemo(doc.category, doc);
            else openUpload(doc.category, doc);
          }}
        />
      )}
    </>
  );

  if (activeCategory) {
    return (
      <>
        <DocumentRepositoryView
          category={activeCategory}
          onBack={() => setActiveCategory(null)}
          currentUser={currentUser}
          onOpenUpload={openUpload}
          onOpenMemo={openMemo}
          onOpenDetail={setDetailDoc}
          refreshToken={refreshToken}
          onMutated={refresh}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reports & Documentation</h1>
          <p className="text-sm text-slate-600">
            Version-controlled knowledge repository for market intelligence and team documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActiveMemberField roster={roster} />
          <Button variant="secondary" onClick={() => openMemo(MEMO_CATEGORIES[0])}>✍ Create live memo</Button>
          <Button variant="primary" onClick={() => openUpload(CATEGORIES[0].id)}>⭱ Upload document</Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Set the active team member above — uploads, memos and comments are attributed to that name.
        </div>
      )}

      {/* Six categories + analytics rail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              stats={stats}
              onOpen={setActiveCategory}
            />
          ))}
        </div>

        <div className="xl:col-span-1">
          <DocumentAnalyticsPanel
            stats={stats}
            loading={statsLoading}
            onOpenDocument={openFromStats}
          />
        </div>
      </div>

      {modals}
    </div>
  );
};

export default ReportsModule;
