import { useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import FormCard from '../../components/common/FormCard';
import { PLATFORMS, SHOT_TYPES, emptyScriptForm } from './socialEngineConstants';

const ACCEPTED_EXTENSIONS = ['.txt', '.doc', '.docx'];

const isAcceptedFile = (file) => {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const ScriptsTab = ({ entries, loading, platformFilter, onCreated, onUpdated, onDeleted }) => {
  const [form, setForm] = useState(emptyScriptForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);

  const scripts = entries.filter((e) => e.scriptFileUrl || e.shotType || e.product);

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const resetForm = () => {
    setForm(emptyScriptForm);
    setEditingId(null);
    setError(null);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setError('Only .txt, .doc, or .docx files are supported.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { scriptFileUrl, scriptFileName } = await bdApi.uploadScriptFile(file);
      setForm((f) => ({ ...f, scriptFileUrl, scriptFileName }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      platform: entry.platform,
      title: entry.title,
      product: entry.product || '',
      model: entry.model || '',
      responsiblePerson: entry.responsiblePerson || '',
      scheduleDate: entry.scheduleDate ? entry.scheduleDate.slice(0, 10) : '',
      shotType: entry.shotType || SHOT_TYPES[0],
      scriptFileUrl: entry.scriptFileUrl || '',
      scriptFileName: entry.scriptFileName || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, status: 'Scripted' };
      if (editingId) {
        const updated = await bdApi.updateSocialContent(editingId, payload);
        onUpdated(updated);
      } else {
        const created = await bdApi.addSocialContent(payload);
        onCreated(created);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this script entry?')) return;
    try {
      await bdApi.deleteSocialContent(id);
      onDeleted(id);
      if (editingId === id) resetForm();
    } catch (err) {
      alert(`Error deleting entry: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      <FormCard
        title={editingId ? 'Edit Script' : 'Add Script'}
        description="Attach a .txt, .doc or .docx script for the team."
        onSubmit={handleSubmit}
        footer={
          <>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel Edit</Button>
            )}
            <Button type="submit" variant="primary" disabled={submitting || uploading}>
              {submitting ? 'Saving...' : editingId ? 'Update Script' : '+ Add Script'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Platform</label>
              <select value={form.platform} onChange={updateForm('platform')} className="w-full form-input">
                {PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={updateForm('title')}
                className="w-full form-input"
                placeholder="e.g. Product Launch Teaser"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Product</label>
              <input type="text" value={form.product} onChange={updateForm('product')} className="w-full form-input" placeholder="e.g. Open Text" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Model / Framework</label>
              <input type="text" value={form.model} onChange={updateForm('model')} className="w-full form-input" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Person to Shoot</label>
              <input type="text" value={form.responsiblePerson} onChange={updateForm('responsiblePerson')} className="w-full form-input" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Date</label>
              <input type="date" value={form.scheduleDate} onChange={updateForm('scheduleDate')} className="w-full form-input" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Shot Type</label>
            <select value={form.shotType} onChange={updateForm('shotType')} className="w-full form-input md:w-1/4">
              {SHOT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Script File</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-navy-500 bg-navy-50'
                  : form.scriptFileUrl
                    ? 'border-forest-300 bg-forest-50/50 hover:border-forest-400'
                    : 'border-slate-300 hover:border-navy-400 hover:bg-slate-50 bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.doc,.docx"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {uploading ? (
                <p className="text-sm text-slate-500">Uploading...</p>
              ) : form.scriptFileUrl ? (
                <p className="text-sm text-navy-700">
                  📄 {form.scriptFileName || 'Uploaded file'}
                  <a href={form.scriptFileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-slate-500 hover:underline" onClick={(e) => e.stopPropagation()}>
                    View
                  </a>
                </p>
              ) : (
                <p className="text-sm text-slate-500">Drag & drop a .txt, .doc, or .docx file, or click to browse</p>
              )}
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
          )}
        </div>
      </FormCard>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          {platformFilter ? `No scripts for ${platformFilter}.` : 'No scripts yet. Add one above.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {scripts.map((entry) => (
            <div key={entry._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-navy-900 text-sm">{entry.title}</span>
                <Badge label={entry.platform} status="active" />
              </div>
              <p className="text-xs text-slate-600">{entry.product || '—'} {entry.model ? `· ${entry.model}` : ''}</p>
              <p className="text-xs text-slate-500">{entry.shotType}</p>
              <p className="text-xs text-slate-500">{entry.responsiblePerson || '—'} {entry.scheduleDate ? `· ${entry.scheduleDate.slice(0, 10)}` : ''}</p>
              {entry.scriptFileUrl && (
                <a href={entry.scriptFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-700 hover:underline">
                  📄 {entry.scriptFileName || 'Download script'}
                </a>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => handleEdit(entry)} className="text-navy-700 hover:underline text-xs cursor-pointer">Edit</button>
                <button type="button" onClick={() => handleDelete(entry._id)} className="text-red-600 hover:underline text-xs cursor-pointer">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScriptsTab;
