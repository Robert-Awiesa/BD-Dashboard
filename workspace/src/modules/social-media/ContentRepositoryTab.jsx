import { useMemo, useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import FormCard from '../../components/common/FormCard';
import { PLATFORMS, OTHER_PLATFORM, platformLabel, POST_TYPES, CONTENT_STATUSES, emptyContentForm } from './socialEngineConstants';

const ContentRepositoryTab = ({ entries, allTitles, loading, platformFilter, onCreated, onUpdated, onDeleted }) => {
  const [form, setForm] = useState(emptyContentForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [groupByPlatform, setGroupByPlatform] = useState(true);
  const fileInputRef = useRef(null);

  const archived = entries.filter((e) => e.postLink || e.coverImage || e.status === 'Published' || e.status === 'Archived');

  const grouped = useMemo(() => {
    if (!groupByPlatform) return { All: archived };
    return archived.reduce((acc, e) => {
      acc[e.platform] = acc[e.platform] || [];
      acc[e.platform].push(e);
      return acc;
    }, {});
  }, [archived, groupByPlatform]);

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const resetForm = () => {
    setForm(emptyContentForm);
    setEditingId(null);
    setError(null);
  };

  // Smart Sync: picking a title already used in Scheduling/Scripts pulls its
  // platform and post type across so the archive entry doesn't duplicate data entry.
  const handleTitlePick = (title) => {
    const match = allTitles.find((e) => e.title === title);
    setForm((f) => ({
      ...f,
      title,
      platform: match?.platform || f.platform,
      postType: match?.postType || f.postType,
    }));
  };

  const handleCoverFile = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { coverImage } = await bdApi.uploadCoverImage(file);
      setForm((f) => ({ ...f, coverImage }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      platform: entry.platform,
      title: entry.title,
      postType: entry.postType || POST_TYPES[0],
      postLink: entry.postLink || '',
      interestingSnippet: entry.interestingSnippet || '',
      coverImage: entry.coverImage || '',
      status: entry.status || 'Published',
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
      if (editingId) {
        const updated = await bdApi.updateSocialContent(editingId, form);
        onUpdated(updated);
      } else {
        const created = await bdApi.addSocialContent(form);
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
    if (!window.confirm('Delete this archive entry?')) return;
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
        title={editingId ? 'Edit Archive Entry' : 'Add to Content Repository'}
        description="Pick an existing title to pull its platform and type across."
        onSubmit={handleSubmit}
        footer={
          <>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel Edit</Button>
            )}
            <Button type="submit" variant="primary" disabled={submitting || uploading}>
              {submitting ? 'Saving...' : editingId ? 'Update Entry' : '+ Add to Archive'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Platform</label>
              <select value={form.platform} onChange={updateForm('platform')} className="w-full form-input">
                {PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
                <option value={OTHER_PLATFORM}>Other…</option>
              </select>
              {/* 'Other' means nothing without the name of the place. */}
              {form.platform === OTHER_PLATFORM && (
                <input
                  type="text"
                  value={form.platformOther}
                  onChange={updateForm('platformOther')}
                  placeholder="Which platform?"
                  className="w-full form-input mt-2"
                />
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Title *</label>
              <input
                type="text"
                required
                list="content-titles"
                value={form.title}
                onChange={(e) => handleTitlePick(e.target.value)}
                className="w-full form-input"
                placeholder="Linked to a scheduled post or script"
              />
              <datalist id="content-titles">
                {allTitles.map((e) => (
                  <option key={e._id} value={e.title} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Content Type</label>
              <select value={form.postType} onChange={updateForm('postType')} className="w-full form-input">
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Link to Published Post</label>
              <input type="url" value={form.postLink} onChange={updateForm('postLink')} className="w-full form-input" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={updateForm('status')} className="w-full form-input">
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Interesting Snippet / Summary</label>
            <textarea
              value={form.interestingSnippet}
              onChange={updateForm('interestingSnippet')}
              rows={2}
              className="w-full form-input resize-y"
              placeholder="What made this post stand out..."
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Cover Image</label>
            <div className="flex items-center gap-3">
              {form.coverImage && (
                <img src={form.coverImage} alt="Cover preview" className="w-14 h-14 shrink-0 object-cover rounded-lg border border-slate-200" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverFile(e.target.files?.[0])}
                className="form-input flex-1"
              />
              {uploading && <span className="text-xs text-slate-500 shrink-0">Uploading...</span>}
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
          )}
        </div>
      </FormCard>

      <div className="flex justify-end">
        <button type="button" onClick={() => setGroupByPlatform((g) => !g)} className="text-xs text-navy-700 hover:underline cursor-pointer">
          {groupByPlatform ? 'View all-in-one' : 'Group by platform'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
        </div>
      ) : archived.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          {platformFilter ? `No archived content for ${platformFilter}.` : 'No archived content yet.'}
        </div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="space-y-2">
            {groupByPlatform && <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{group}</h4>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((entry) => (
                <div key={entry._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  {entry.coverImage && (
                    <img src={entry.coverImage} alt={entry.title} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-navy-900 text-sm">{entry.title}</span>
                      <Badge label={entry.status} status={entry.status === 'Published' ? 'success' : 'default'} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={platformLabel(entry)} status="active" />
                      {entry.postType && <span className="text-xs text-slate-500">{entry.postType}</span>}
                    </div>
                    {entry.interestingSnippet && (
                      <p className="text-xs text-slate-600 line-clamp-2">{entry.interestingSnippet}</p>
                    )}
                    {entry.postLink && (
                      <a href={entry.postLink} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-700 hover:underline">
                        View post ↗
                      </a>
                    )}
                    <div className="flex justify-end gap-2 pt-2 mt-auto border-t border-slate-100">
                      <button type="button" onClick={() => handleEdit(entry)} className="text-navy-700 hover:underline text-xs cursor-pointer">Edit</button>
                      <button type="button" onClick={() => handleDelete(entry._id)} className="text-red-600 hover:underline text-xs cursor-pointer">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ContentRepositoryTab;
