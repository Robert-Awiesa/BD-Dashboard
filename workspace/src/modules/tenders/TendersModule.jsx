import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

const TendersModule = () => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New tender form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Opening Tender');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    bdApi.getTenders()
      .then((data) => {
        if (!ignore) setTenders(data);
      })
      .catch((err) => {
        console.error("Failed to fetch tenders:", err);
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
    if (!title.trim()) return;
    try {
      setSubmitting(true);
      const newTender = await bdApi.addTender({ title, category, deadline, status: 'active' });
      setTenders([newTender, ...tenders]);
      setTitle('');
      setDeadline('');
      setShowForm(false);
    } catch (err) {
      alert(`Error creating tender: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tender notice?')) return;
    try {
      await bdApi.deleteTender(id);
      setTenders(tenders.filter((t) => t._id !== id));
    } catch (err) {
      alert(`Error deleting tender: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Tenders & EOI</h1>
          <p className="text-sm text-slate-600">Track public notices, expected requests for proposals, and submissions.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Log Tender / EOI'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm animate-fade-in">
          <h3 className="text-sm font-semibold text-navy-800">Log New Tender or EOI</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tender Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cloud Migration RFP"
                className="w-full form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full form-input"
              >
                <option value="Opening Tender">Opening Tender</option>
                <option value="Sent Tender">Sent Tender</option>
                <option value="EOI">EOI</option>
                <option value="Expected RFP">Expected RFP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Deadline Date</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full form-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Tender'}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Active & Opening Tenders / EOIs">
          {loading ? (
            <div className="space-y-3">
              <div className="h-16 skeleton"></div>
              <div className="h-16 skeleton"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              Failed to connect to backend: {error}
            </div>
          ) : tenders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No tenders logged yet.</div>
          ) : (
            <div className="space-y-3">
              {tenders.map((tender) => (
                <div key={tender._id || tender.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center hover:border-slate-300 transition-colors">
                  <div>
                    <span className="text-xs text-navy-700 font-semibold uppercase">{tender.category}</span>
                    <h4 className="font-medium text-navy-900">{tender.title}</h4>
                    {tender.deadline && (
                      <p className="text-xs text-slate-600 mt-1">Deadline: {tender.deadline}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={tender.status} status={tender.status} />
                    <button
                      onClick={() => handleDelete(tender._id)}
                      className="text-slate-500 hover:text-red-600 text-xs transition-colors p-1"
                      title="Delete tender"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Newspaper Review & Expected RFPs">
          <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-sm font-medium text-slate-600">Clip or upload newspaper tender entries</p>
            <p className="text-xs text-slate-500">Drag and drop clipped notices or paste snippets here for AI extraction.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TendersModule;