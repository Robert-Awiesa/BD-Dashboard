import { useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import FormCard from '../../components/common/FormCard';
import { PLATFORMS, POST_TYPES, emptyScheduleForm, dayOfWeekFromDate } from './socialEngineConstants';

const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const ScheduleTab = ({ entries, allTitles, loading, platformFilter, onCreated, onUpdated, onDeleted }) => {
  const [form, setForm] = useState(emptyScheduleForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const scheduledEntries = useMemo(() => {
    const rows = entries.filter((e) => e.scheduleDate);
    return rows.sort((a, b) => {
      const diff = new Date(a.scheduleDate) - new Date(b.scheduleDate);
      return sortAsc ? diff : -diff;
    });
  }, [entries, sortAsc]);

  // Smart Sync: picking an existing title (e.g. from the Scripts Repository) pulls
  // its platform/product context in so the same details aren't re-typed here.
  const handleTitlePick = (title) => {
    const match = allTitles.find((e) => e.title === title);
    setForm((f) => ({
      ...f,
      title,
      platform: match?.platform || f.platform,
    }));
  };

  const resetForm = () => {
    setForm(emptyScheduleForm);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      platform: entry.platform,
      title: entry.title,
      scheduleDate: toDateInputValue(entry.scheduleDate),
      time: entry.time || '',
      postType: entry.postType || POST_TYPES[0],
      responsiblePerson: entry.responsiblePerson || '',
      message: entry.message || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.scheduleDate || !form.time) {
      setError('Title, Date, and Time are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        status: 'Scheduled',
      };
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
    if (!window.confirm('Delete this scheduled post?')) return;
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
        title={editingId ? 'Edit Scheduled Post' : 'Schedule New Post'}
        description="Date auto-fills the day of the week."
        onSubmit={handleSubmit}
        footer={
          <>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel Edit</Button>
            )}
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Post' : '+ Add to Schedule'}
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
              <label className="block text-xs text-slate-600 mb-1">Title / Campaign Name *</label>
              <input
                type="text"
                required
                list="social-titles"
                value={form.title}
                onChange={(e) => handleTitlePick(e.target.value)}
                className="w-full form-input"
                placeholder="e.g. Product Launch Teaser"
              />
              <datalist id="social-titles">
                {allTitles.map((e) => (
                  <option key={e._id} value={e.title} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.scheduleDate}
                onChange={updateForm('scheduleDate')}
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Day</label>
              <input
                type="text"
                readOnly
                value={dayOfWeekFromDate(form.scheduleDate)}
                className="w-full form-input"
                placeholder="Auto"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Time *</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={updateForm('time')}
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Post Type</label>
              <select value={form.postType} onChange={updateForm('postType')} className="w-full form-input">
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Person Responsible</label>
              <input
                type="text"
                value={form.responsiblePerson}
                onChange={updateForm('responsiblePerson')}
                className="w-full form-input"
                placeholder="e.g. Thabo M."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Message / Caption</label>
              <textarea
                value={form.message}
                onChange={updateForm('message')}
                rows={2}
                className="w-full form-input resize-y"
                placeholder="Caption text..."
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
          )}
        </div>
      </FormCard>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2 cursor-pointer select-none" onClick={() => setSortAsc((s) => !s)}>
                  Date {sortAsc ? '▲' : '▼'}
                </th>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Post Type</th>
                <th className="px-3 py-2">Responsible</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Loading...</td></tr>
              ) : scheduledEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    {platformFilter ? `No scheduled posts for ${platformFilter}.` : 'No scheduled posts yet.'}
                  </td>
                </tr>
              ) : (
                scheduledEntries.map((entry) => (
                  <tr key={entry._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2"><Badge label={entry.platform} status="active" /></td>
                    <td className="px-3 py-2 font-medium text-navy-900">{entry.title}</td>
                    <td className="px-3 py-2 text-slate-600">{toDateInputValue(entry.scheduleDate)}</td>
                    <td className="px-3 py-2 text-slate-600">{entry.dayOfWeek}</td>
                    <td className="px-3 py-2 text-slate-600">{entry.time}</td>
                    <td className="px-3 py-2 text-slate-600">{entry.postType}</td>
                    <td className="px-3 py-2 text-slate-600">{entry.responsiblePerson || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={entry.message}>{entry.message || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button type="button" onClick={() => handleEdit(entry)} className="text-navy-700 hover:underline text-xs mr-2 cursor-pointer">Edit</button>
                      <button type="button" onClick={() => handleDelete(entry._id)} className="text-red-600 hover:underline text-xs cursor-pointer">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScheduleTab;
