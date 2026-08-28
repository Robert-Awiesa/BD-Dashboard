import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/useDashboard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';

// Where the launcher used to live, before it moved to the server. Anything
// still sitting here is one browser's private list; it gets folded into the
// shared one on first load and the key is then dropped for good.
const LEGACY_KEY = 'bd_workspace_custom_tools';

const CATEGORY_OPTIONS = [
  'Lead Generation', 'AI & Strategy', 'Market Intelligence',
  'Automation', 'Campaigns', 'CRM & Workspace', 'Custom',
];

const emptyForm = { name: '', url: '', desc: '', category: 'Custom', icon: '🌐' };

// One migration per page load, shared by every caller. Held at module scope
// because React runs the effect twice on mount: without this the second run
// finds the key already claimed, skips the upload, and lists the launcher
// while the first run's upload is still in flight — so the tool it just
// carried over is missing until the next visit.
let migration = null;

const migrateLocalLauncher = async (currentUser) => {
  let stored;
  // Claimed before the upload so a second call cannot upload the same list.
  try {
    stored = localStorage.getItem(LEGACY_KEY);
    if (stored) localStorage.removeItem(LEGACY_KEY);
  } catch {
    return; // private window — nothing to migrate
  }
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length) {
      // The server keeps only the links nobody has added yet, so running this
      // from a second machine contributes that machine's extras instead of
      // duplicating the whole list.
      await bdApi.importTools(parsed, currentUser);
    }
  } catch {
    // Put it back so the next load can try again — except when the data itself
    // is unreadable, which retrying will not fix.
    try {
      JSON.parse(stored);
      localStorage.setItem(LEGACY_KEY, stored);
    } catch { /* unparseable; dropping it is the only way forward */ }
  }
};

const migrateOnce = (currentUser) => {
  if (!migration) migration = migrateLocalLauncher(currentUser);
  return migration;
};

const getHostName = (url) => {
  if (!url) return '';
  try {
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    return new URL(formatted).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
};

const ToolsModule = () => {
  const { currentUser } = useDashboard();

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      await migrateOnce(currentUser);
      const rows = await bdApi.getTools({ includeArchived: includeArchived ? 'true' : '' });
      if (ignore) return;
      setTools(Array.isArray(rows) ? rows : []);
      setError(null);
    };

    load()
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [includeArchived, reloadToken, currentUser]);

  const handleLaunch = (url) => {
    if (!url) return;
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
  };

  const openAddModal = () => {
    setEditingTool(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (tool, e) => {
    e.stopPropagation();
    setEditingTool(tool);
    setForm({
      name: tool.name || '',
      url: tool.url || '',
      desc: tool.desc || '',
      category: tool.category || 'Custom',
      icon: tool.icon || '🌐',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleArchive = async (tool, e) => {
    e.stopPropagation();
    try {
      await bdApi.setToolArchived(tool._id, !tool.archived);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTool = async (tool, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${tool.name} from everyone's launcher?`)) return;
    try {
      await bdApi.deleteTool(tool._id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Please provide a tool name.');
    if (!form.url.trim()) {
      return setFormError('Please provide a valid web URL (e.g. https://claude.ai).');
    }
    setBusy(true);
    try {
      const payload = { ...form, addedBy: currentUser || '' };
      if (editingTool) await bdApi.updateTool(editingTool._id, payload);
      else await bdApi.addTool(payload);
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const categories = ['All', ...new Set(tools.map((t) => t.category || 'Other'))];

  const filteredTools = activeCategory === 'All'
    ? tools
    : tools.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Working Tools Launcher</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Quick-launch shortcuts to the platforms the team works in. Shared — a shortcut you add is on everybody&apos;s launcher.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-navy-700 cursor-pointer"
            />
            Show archived
          </label>
          <Button variant="primary" onClick={openAddModal} className="text-xs">
            + Add Tool Shortcut
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); reload(); }}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-navy-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 skeleton rounded-2xl" />)}
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-slate-300 rounded-2xl bg-white space-y-2">
          <span className="text-3xl">🧰</span>
          <p className="text-base font-bold text-navy-950">Nothing on the launcher yet.</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add the web apps the team works in and they will be one click away for everybody.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={openAddModal}>+ Add Tool Shortcut</Button>
          </div>
        </div>
      ) : (
        /* Tools Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTools.map((tool) => (
            <div
              key={tool._id}
              onClick={() => handleLaunch(tool.url)}
              className={`group bg-white border rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-navy-400 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                tool.archived ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}
            >
              {/* Top decorative accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-navy-800 via-emerald-600 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                {/* Tool Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-navy-50 text-xl flex items-center justify-center border border-slate-200/80 group-hover:border-navy-200 transition-colors shrink-0">
                      {tool.icon || '🌐'}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-navy-950 group-hover:text-navy-700 transition-colors flex items-center gap-1.5">
                        {tool.name}
                        <span className="text-xs text-slate-400 group-hover:text-navy-600 font-normal">↗</span>
                      </h3>
                      {tool.url && (
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          🌐 {getHostName(tool.url)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => openEditModal(tool, e)}
                      className="p-1 text-slate-400 hover:text-navy-800 text-xs rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit link"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleArchive(tool, e)}
                      className="p-1 text-slate-400 hover:text-amber-700 text-xs rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      title={tool.archived ? 'Put back on the launcher' : 'Archive this shortcut'}
                    >
                      {tool.archived ? '↩' : '📦'}
                    </button>
                    {tool.archived && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTool(tool, e)}
                        className="p-1 text-slate-400 hover:text-red-700 text-xs rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Delete for good"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3.5 leading-relaxed line-clamp-2">
                  {tool.desc}
                </p>
                {tool.addedBy && !tool.isDefault && (
                  <p className="text-[10px] text-slate-400 mt-1.5">Added by {tool.addedBy}</p>
                )}
              </div>

              {/* Launch Button Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {tool.archived ? 'Archived' : tool.category || 'Tool'}
                </span>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunch(tool.url);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 bg-navy-50 hover:bg-navy-700 hover:text-white text-navy-900 border-navy-200 transition-all cursor-pointer"
                >
                  Launch Tool ↗
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Tool Link Modal */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingTool ? `✎ Edit ${editingTool.name} Link` : '+ Add Custom Tool Shortcut'}
          description="Configure destination web link and launch details for your workspace tool."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="tool-form" disabled={busy}>
                {busy ? 'Saving…' : editingTool ? 'Save Link Changes' : 'Add Tool Shortcut'}
              </Button>
            </div>
          }
        >
          <form id="tool-form" onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="form-label" htmlFor="tool-name">Tool / Application Name *</label>
              <input
                id="tool-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Claude AI, HubSpot CRM, Figma"
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="tool-url">Destination Web URL Link *</label>
              <input
                id="tool-url"
                type="text"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="e.g. https://claude.ai or apollo.io"
                className="form-input text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Opens in a new tab. If you leave off the https:// it is added for you.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="tool-category">Category</label>
                <select
                  id="tool-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="form-input text-xs"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c === 'Custom' ? 'Custom Tool' : c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="tool-icon">Emoji Icon</label>
                <input
                  id="tool-icon"
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="e.g. 🎯, 🧠, ⚡, 🔍, 🤖"
                  className="form-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="tool-desc">Short Description</label>
              <textarea
                id="tool-desc"
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                rows={2}
                placeholder="Brief summary of what this tool is used for in your workflow..."
                className="form-input text-xs"
              />
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {formError}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ToolsModule;
