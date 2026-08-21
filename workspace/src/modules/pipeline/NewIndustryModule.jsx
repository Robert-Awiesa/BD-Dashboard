import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const STATUS_OPTIONS = ['active', 'ongoing', 'cold', 'success'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const SOURCE_OPTIONS = ['Referral', 'LinkedIn', 'Event', 'Inbound', 'Cold Outreach', 'Other'];
const PRIORITY_BADGE_STATUS = { High: 'danger', Medium: 'ongoing', Low: 'cold' };

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatFollowUp = (value) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const isOverdue = (value) => {
  if (!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return value < today;
};

const formatValue = (value) => {
  if (!value) return null;
  return `$${Number(value).toLocaleString()}`;
};

const emptyForm = {
  name: '',
  type: 'New Industry',
  contact: '',
  status: 'active',
  priority: 'Medium',
  value: '',
  nextFollowUp: '',
  source: '',
  notes: '',
};

const NewIndustryModule = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [converting, setConverting] = useState(false);

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    let ignore = false;
    bdApi.getPipeline()
      .then((data) => {
        if (!ignore) setItems(data.filter((item) => item.type === 'New Industry'));
      })
      .catch((err) => {
        console.error('Failed to load pipeline:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSubmitting(true);
      const payload = { ...form, value: form.value ? Number(form.value) : 0 };
      if (editingId) {
        const saved = await bdApi.updatePipelineItem(editingId, payload);
        setItems((prev) => prev.map((it) => (it._id === saved._id ? saved : it)));
        setSelectedItem((cur) => (cur && cur._id === saved._id ? saved : cur));
        setEditingId(null);
      } else {
        const newItem = await bdApi.addPipelineItem(payload);
        setItems((prev) => [newItem, ...prev]);
      }
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      alert(`Error saving item: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Load an existing item into the same form the create flow uses, rather than
  // maintaining a second edit form that could drift from it.
  const startEdit = (item) => {
    setForm({
      name: item.name || '',
      type: item.type || 'New Industry',
      contact: item.contact || '',
      status: item.status || 'active',
      priority: item.priority || 'Medium',
      value: item.value ?? '',
      nextFollowUp: item.nextFollowUp ? String(item.nextFollowUp).slice(0, 10) : '',
      source: item.source || '',
      notes: item.notes || '',
    });
    setEditingId(item._id);
    setSelectedItem(null);
    setShowForm(true);
  };

  // A won pipeline item becomes an account in Client Relations. The server
  // refuses a second conversion, so the error is surfaced rather than swallowed.
  const handleConvert = async (item) => {
    setConverting(true);
    try {
      await bdApi.convertPipelineItemToClient(item._id, {});
      alert(`"${item.name}" is now a client — find it under Client Relations.`);
      setSelectedItem(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await bdApi.deletePipelineItem(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setSelectedItem(null);
    } catch (err) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900">New Industry</h2>
          <p className="text-sm text-slate-600">New vertical / market exploration.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            if (showForm) { setForm(emptyForm); setEditingId(null); }
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Cancel' : '+ New Pipeline Item'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm animate-fade-in">
          {editingId && (
            <p className="text-xs font-semibold text-navy-800">Editing an existing pipeline item</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Lead / Company Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={updateForm('name')}
                placeholder="e.g. Acme Corp Infrastructure"
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Contact Person</label>
              <input
                type="text"
                value={form.contact}
                onChange={updateForm('contact')}
                placeholder="e.g. Jane Doe"
                className="w-full form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={updateForm('status')} className="w-full form-input">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Priority</label>
              <select value={form.priority} onChange={updateForm('priority')} className="w-full form-input">
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Est. Value ($)</label>
              <input
                type="number"
                min="0"
                value={form.value}
                onChange={updateForm('value')}
                placeholder="0"
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Next Follow-up</label>
              <input
                type="date"
                value={form.nextFollowUp}
                onChange={updateForm('nextFollowUp')}
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Source</label>
              <select value={form.source} onChange={updateForm('source')} className="w-full form-input">
                <option value="">—</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={updateForm('notes')}
              placeholder="Context, next steps, key details..."
              rows={2}
              className="w-full form-input resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Item'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 skeleton" />
          <div className="h-14 skeleton" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to connect to backend: {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          No items yet. Click "+ New Pipeline Item" to add one.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const followUp = formatFollowUp(item.nextFollowUp);
            const value = formatValue(item.value);
            const overdue = isOverdue(item.nextFollowUp);
            return (
              <button
                key={item._id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left p-3 bg-white rounded-lg border border-slate-200 hover:border-navy-300 hover:shadow-sm transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-navy-900 text-sm">{item.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-navy-50 text-navy-700 uppercase whitespace-nowrap">
                    {item.status}
                  </span>
                </div>
                {item.contact && (
                  <p className="text-xs text-slate-600 mt-1">Contact: {item.contact}</p>
                )}
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {item.priority && (
                    <Badge label={item.priority} status={PRIORITY_BADGE_STATUS[item.priority]} />
                  )}
                  {value && (
                    <span className="text-xs font-medium text-forest-700">{value}</span>
                  )}
                  {followUp && (
                    <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {overdue ? '⚠ ' : '📅 '}{followUp}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.name}>
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-2">
              <Badge label={selectedItem.type} status="active" />
              <Badge label={selectedItem.status} status={selectedItem.status} />
              {selectedItem.priority && (
                <Badge label={`${selectedItem.priority} Priority`} status={PRIORITY_BADGE_STATUS[selectedItem.priority]} />
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Contact</dt>
                <dd className="text-slate-700 mt-0.5">{selectedItem.contact || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Source</dt>
                <dd className="text-slate-700 mt-0.5">{selectedItem.source || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Est. Value</dt>
                <dd className="text-slate-700 mt-0.5">{formatValue(selectedItem.value) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Next Follow-up</dt>
                <dd className={`mt-0.5 ${isOverdue(selectedItem.nextFollowUp) ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                  {formatFollowUp(selectedItem.nextFollowUp) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Created</dt>
                <dd className="text-slate-700 mt-0.5">{formatDate(selectedItem.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Last Updated</dt>
                <dd className="text-slate-700 mt-0.5">{formatDate(selectedItem.updatedAt)}</dd>
              </div>
            </dl>
            {selectedItem.notes && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Notes</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">
                  {selectedItem.notes}
                </dd>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="danger" onClick={() => handleDelete(selectedItem._id)}>
                🗑️ Delete Item
              </Button>
              <Button
                variant="success"
                disabled={converting}
                onClick={() => handleConvert(selectedItem)}
              >
                {converting ? 'Converting…' : '🤝 Convert to client'}
              </Button>
              <Button variant="primary" onClick={() => startEdit(selectedItem)}>
                ✎ Edit Item
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NewIndustryModule;
