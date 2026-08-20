import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';

// Client appreciation reuses the existing Milestone model rather than growing a
// parallel one: it already handles recurring month/day dates, next-occurrence
// maths across year boundaries (including 29 Feb), tenure counting, and it is
// already swept by the nightly reminder cron. A `client` ref is all it needed.
const CLIENT_MILESTONE_TYPES = ['Client Anniversary', 'Client Contact Birthday'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const emptyForm = {
  milestoneType: 'Client Contact Birthday',
  participantName: '',
  milestoneMonth: String(new Date().getMonth() + 1),
  milestoneDay: String(new Date().getDate()),
  originalStartDate: '',
  notes: '',
};

const ClientAppreciation = ({ client, refreshToken }) => {
  const [milestones, setMilestones] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    bdApi.getMilestones({ client: client._id })
      .then((list) => { if (!ignore) setMilestones(list); })
      .catch(() => { if (!ignore) setMilestones([]); });
    return () => { ignore = true; };
  }, [client._id, refreshToken, reloadToken]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      await bdApi.addMilestone({
        ...payload,
        client: client._id,
        departmentOrCompany: client.name,
        milestoneMonth: Number(payload.milestoneMonth),
        milestoneDay: Number(payload.milestoneDay),
        originalStartDate: payload.originalStartDate || undefined,
      });
      setForm(emptyForm);
      setAdding(false);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await bdApi.deleteMilestone(id);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const hasAnniversary = milestones.some((m) => m.milestoneType === 'Client Anniversary');

  // The relationship start date is already on the record, so turning it into a
  // recurring anniversary should not require re-typing it.
  const addAnniversaryFromStart = () => {
    const start = new Date(client.relationshipStart);
    save({
      milestoneType: 'Client Anniversary',
      participantName: client.name,
      milestoneMonth: start.getMonth() + 1,
      milestoneDay: start.getDate(),
      originalStartDate: client.relationshipStart,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900">Appreciation dates</h3>
          <p className="text-xs text-slate-500">
            Anniversaries and contact birthdays. The nightly sweep reminds the account owner two days out.
          </p>
        </div>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>+ Add date</Button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 mb-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {client.relationshipStart && !hasAnniversary && !adding && (
        <button
          onClick={addAnniversaryFromStart}
          disabled={busy}
          className="w-full text-left px-3 py-2 mb-2 rounded-lg border border-dashed border-navy-300 bg-navy-50/50 text-xs text-navy-800 hover:bg-navy-50 cursor-pointer transition-colors"
        >
          + Track the relationship anniversary from{' '}
          {new Date(client.relationshipStart).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
        </button>
      )}

      {adding && (
        <form
          onSubmit={(e) => { e.preventDefault(); save(form); }}
          className="rounded-lg border border-slate-200 p-3 mb-3 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={form.milestoneType} onChange={update('milestoneType')} className="form-input text-sm">
              {CLIENT_MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text" value={form.participantName} onChange={update('participantName')}
              placeholder={form.milestoneType === 'Client Anniversary' ? client.name : 'Contact name'}
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={form.milestoneMonth} onChange={update('milestoneMonth')} className="form-input text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input
              type="number" min="1" max="31" value={form.milestoneDay}
              onChange={update('milestoneDay')} placeholder="Day" className="form-input"
            />
            {form.milestoneType === 'Client Anniversary' && (
              <input
                type="date" value={form.originalStartDate} onChange={update('originalStartDate')}
                className="form-input" title="Start year, so the reminder can count the years"
              />
            )}
          </div>
          <p className="text-xs text-slate-500">
            Stored as month and day, so it recurs every year without being reset.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setAdding(false); setError(null); }}>Cancel</Button>
            <Button
              variant="primary" type="submit"
              disabled={busy || !(form.participantName.trim() || form.milestoneType === 'Client Anniversary')}
            >
              {busy ? 'Saving…' : 'Add date'}
            </Button>
          </div>
        </form>
      )}

      {milestones.length === 0 && !adding ? (
        <p className="text-xs text-slate-400 py-1">No appreciation dates tracked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {milestones.map((m) => (
            <li key={m._id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200">
              <span className="min-w-0">
                <span className="block text-sm text-navy-900 truncate">
                  {m.milestoneType === 'Client Anniversary' ? '🤝' : '🎂'} {m.participantName}
                  {m.yearsCompleted ? ` — ${m.yearsCompleted} year(s)` : ''}
                </span>
                <span className="block text-xs text-slate-500">
                  {MONTHS[m.milestoneMonth - 1]} {m.milestoneDay}
                  {m.daysUntil !== null && m.daysUntil !== undefined
                    ? ` · ${m.daysUntil === 0 ? 'today' : `in ${m.daysUntil} day(s)`}`
                    : ''}
                </span>
              </span>
              <button
                onClick={() => remove(m._id)}
                className="shrink-0 text-xs text-slate-400 hover:text-red-700 cursor-pointer"
                aria-label={`Remove ${m.participantName}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ClientAppreciation;
