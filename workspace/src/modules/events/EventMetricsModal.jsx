import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import { bdApi } from '../../context/services/api';
import { EVENT_METRIC_FIELDS } from './eventConstants';

const INDUSTRIES = ['Oil and Gas', 'Manufacturing', 'Mining', 'Logistics', 'Financial', 'Others'];

const emptyLead = {
  company: '', industry: INDUSTRIES[0], contactPerson: '',
  primaryEmail: '', primaryContact: '', position: '',
};

const EventMetricsModal = ({ open, onClose, event, onUpdated }) => {
  const [tab, setTab] = useState('metrics');
  const [metrics, setMetrics] = useState(() =>
    EVENT_METRIC_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: event?.metrics?.[f.key] ?? '' }), {})
  );
  const [achievements, setAchievements] = useState(() => ({
    keyTakeaways: event?.achievements?.keyTakeaways || [],
    attendeeFeedback: event?.achievements?.attendeeFeedback || [],
    growthRecommendations: event?.achievements?.growthRecommendations || [],
  }));
  const [lead, setLead] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (!event) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await bdApi.saveEventMetrics(event._id, { metrics, achievements });
      onUpdated(updated);
      setNotice('Metrics saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pushLead = async () => {
    setError(null);
    if (!lead.company.trim() || !lead.contactPerson.trim() || !lead.primaryEmail.trim() || !lead.primaryContact.trim()) {
      setError('Company, contact person, email and phone are required to create a prospecting lead.');
      return;
    }
    setSaving(true);
    try {
      await bdApi.convertEventLead(event._id, lead);
      setLead(emptyLead);
      setNotice(`${lead.company} pushed to Prospecting Leads.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'metrics', label: 'Reach & Engagement' },
    { key: 'wins', label: 'Achievements' },
    { key: 'leads', label: 'BD Impact' },
  ];

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
      {tab === 'leads' ? (
        <Button type="button" variant="success" onClick={pushLead} disabled={saving}>
          {saving ? 'Working...' : 'Push to Prospecting Leads'}
        </Button>
      ) : (
        <Button type="button" variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Performance Matrix" description={event.title} size="lg" footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setNotice(null); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === t.key ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'metrics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            {EVENT_METRIC_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-slate-600 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={metrics[f.key] ?? ''}
                  onChange={(e) => setMetrics((m) => ({ ...m, [f.key]: e.target.value }))}
                  className="w-full form-input"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'wins' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">🏆 Key Takeaways</label>
              <TagInput value={achievements.keyTakeaways} onChange={(v) => setAchievements((a) => ({ ...a, keyTakeaways: v }))} placeholder="Add a takeaway..." />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">💬 Attendee Feedback</label>
              <TagInput value={achievements.attendeeFeedback} onChange={(v) => setAchievements((a) => ({ ...a, attendeeFeedback: v }))} placeholder="Add feedback..." />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">📈 Growth Recommendations (next session)</label>
              <TagInput value={achievements.growthRecommendations} onChange={(v) => setAchievements((a) => ({ ...a, growthRecommendations: v }))} placeholder="Add a recommendation..." />
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Capture a prospect who engaged during this session — it lands directly in the Prospecting Leads pipeline, already stamped with this event.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Company *</label>
                <input type="text" value={lead.company} onChange={(e) => setLead((l) => ({ ...l, company: e.target.value }))} className="w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Industry</label>
                <select value={lead.industry} onChange={(e) => setLead((l) => ({ ...l, industry: e.target.value }))} className="w-full form-input">
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Contact Person *</label>
                <input type="text" value={lead.contactPerson} onChange={(e) => setLead((l) => ({ ...l, contactPerson: e.target.value }))} className="w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Position</label>
                <input type="text" value={lead.position} onChange={(e) => setLead((l) => ({ ...l, position: e.target.value }))} className="w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Primary Email *</label>
                <input type="email" value={lead.primaryEmail} onChange={(e) => setLead((l) => ({ ...l, primaryEmail: e.target.value }))} className="w-full form-input" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Primary Contact *</label>
                <input type="tel" value={lead.primaryContact} onChange={(e) => setLead((l) => ({ ...l, primaryContact: e.target.value }))} className="w-full form-input" />
              </div>
            </div>
          </div>
        )}

        {notice && <div className="p-2.5 bg-forest-50 border border-forest-200 rounded-lg text-forest-700 text-xs">{notice}</div>}
        {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      </div>
    </Modal>
  );
};

export default EventMetricsModal;
