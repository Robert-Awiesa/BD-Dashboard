import { useEffect, useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';

const DEFAULT_TOOLS = [
  {
    id: 'apollo',
    name: 'Apollo.io',
    desc: 'B2B lead enrichment, contact database, and sales engagement platform.',
    url: 'https://apollo.io',
    category: 'Lead Generation',
    icon: '🎯',
  },
  {
    id: 'claude',
    name: 'Claude AI',
    desc: 'AI assistant for drafting proposals, copy, technical specs, and strategy.',
    url: 'https://claude.ai',
    category: 'AI & Strategy',
    icon: '🧠',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    desc: 'Real-time market research, web intelligence, and competitor analysis.',
    url: 'https://www.perplexity.ai',
    category: 'Market Intelligence',
    icon: '🔍',
  },
  {
    id: 'dripify',
    name: 'Dripify',
    desc: 'LinkedIn automation tool for prospecting and sequence campaigns.',
    url: 'https://dripify.io',
    category: 'Automation',
    icon: '⚡',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    desc: 'Advanced language model for brainstorming, content generation, and code.',
    url: 'https://chatgpt.com',
    category: 'AI & Strategy',
    icon: '🤖',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    desc: 'Email marketing platform for outreach campaigns and broadcast tracking.',
    url: 'https://mailchimp.com',
    category: 'Campaigns',
    icon: '✉️',
  },
];

const LOCAL_STORAGE_KEY = 'bd_workspace_custom_tools';

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
  const [tools, setTools] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');

  // Modal State for Adding/Editing Custom Tool Shortcut
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    desc: '',
    category: 'Custom',
    icon: '🌐',
  });
  const [error, setError] = useState(null);

  // Load tools combining defaults and user-added custom links
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTools(parsed);
      } else {
        setTools(DEFAULT_TOOLS);
      }
    } catch {
      setTools(DEFAULT_TOOLS);
    }
  }, []);

  const saveTools = (updatedTools) => {
    setTools(updatedTools);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTools));
    } catch (err) {
      console.error('Failed to save tools to localStorage:', err);
    }
  };

  const handleLaunch = (url) => {
    if (!url) return;
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
  };

  const openAddModal = () => {
    setEditingTool(null);
    setForm({ name: '', url: '', desc: '', category: 'Custom', icon: '🌐' });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (tool, e) => {
    e.stopPropagation();
    setEditingTool(tool);
    setForm({
      name: tool.name,
      url: tool.url,
      desc: tool.desc,
      category: tool.category || 'Custom',
      icon: tool.icon || '🌐',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleDeleteTool = (toolId, e) => {
    e.stopPropagation();
    if (!window.confirm('Remove this custom tool shortcut?')) return;
    const updated = tools.filter((t) => t.id !== toolId);
    saveTools(updated);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Please provide a tool name.');
      return;
    }
    if (!form.url.trim()) {
      setError('Please provide a valid web URL (e.g. https://claude.ai).');
      return;
    }

    let formattedUrl = form.url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    if (editingTool) {
      const updated = tools.map((t) =>
        t.id === editingTool.id
          ? { ...t, name: form.name.trim(), url: formattedUrl, desc: form.desc.trim(), category: form.category, icon: form.icon }
          : t
      );
      saveTools(updated);
    } else {
      const newTool = {
        id: `custom_${Date.now()}`,
        name: form.name.trim(),
        url: formattedUrl,
        desc: form.desc.trim() || 'Custom workplace shortcut tool.',
        category: form.category || 'Custom',
        icon: form.icon || '🌐',
      };
      saveTools([...tools, newTool]);
    }
    setModalOpen(false);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Reset tools launcher to default pre-configured shortcuts?')) return;
    saveTools(DEFAULT_TOOLS);
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
            Quick-launch shortcuts and customizable web app links to core intelligence platforms and internal tools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleResetDefaults} className="text-xs">
            🔄 Reset Defaults
          </Button>
          <Button variant="primary" onClick={openAddModal} className="text-xs">
            + Add Tool Shortcut
          </Button>
        </div>
      </div>

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

      {/* Tools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => handleLaunch(tool.url)}
            className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-navy-400 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
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
                    className="p-1 text-slate-400 hover:text-navy-800 text-xs rounded hover:bg-slate-100 transition-colors"
                    title="Edit Link"
                  >
                    ✎
                  </button>
                  {tool.id.startsWith('custom_') && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTool(tool.id, e)}
                      className="p-1 text-slate-400 hover:text-red-700 text-xs rounded hover:bg-slate-100 transition-colors"
                      title="Delete Shortcut"
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
            </div>

            {/* Launch Button Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {tool.category || 'Tool'}
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
              <Button variant="primary" onClick={handleFormSubmit}>
                {editingTool ? 'Save Link Changes' : 'Add Tool Shortcut'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="form-label">Tool / Application Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Claude AI, HubSpot CRM, Figma"
                className="form-input text-xs"
                required
              />
            </div>

            <div>
              <label className="form-label">Destination Web URL Link *</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="e.g. https://claude.ai or https://apollo.io"
                className="form-input text-xs"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Launches directly in a new browser tab via <code className="bg-slate-100 px-1 py-0.5 rounded text-navy-800 font-mono">window.open(url, &apos;_blank&apos;)</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="form-input text-xs"
                >
                  <option value="Lead Generation">Lead Generation</option>
                  <option value="AI & Strategy">AI & Strategy</option>
                  <option value="Market Intelligence">Market Intelligence</option>
                  <option value="Automation">Automation</option>
                  <option value="Campaigns">Campaigns</option>
                  <option value="CRM & Workspace">CRM & Workspace</option>
                  <option value="Custom">Custom Tool</option>
                </select>
              </div>

              <div>
                <label className="form-label">Emoji Icon</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="e.g. 🎯, 🧠, ⚡, 🔍, 🤖"
                  className="form-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Short Description</label>
              <textarea
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                rows={2}
                placeholder="Brief summary of what this tool is used for in your workflow..."
                className="form-input text-xs"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {error}
              </div>
            )}

            <button type="submit" className="hidden" tabIndex={-1} />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ToolsModule;