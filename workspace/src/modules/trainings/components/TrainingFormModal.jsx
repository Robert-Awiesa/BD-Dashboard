import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { bdApi } from '../../../context/services/api';

const PROGRESS_OPTIONS = ['Planned', 'In Progress', 'Completed', 'Cancelled'];
const COST_OPTIONS = ['Free', 'Paid / Sponsored', 'Self-Funded'];

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const emptyForm = {
  type: 'Internal',
  title: '',
  facilitator: '',
  description: '',
  progress: 'Planned',
  takeaways: '',
  dateRange: {
    start: '',
    end: '',
  },
  participants: [],
  externalDetails: {
    organizers: '',
    country: '',
    modality: 'Online',
    cost: 'Free',
  },
};

const TrainingFormModal = ({
  open,
  onClose,
  onSaved,
  existing = null,
  initialType = 'Internal',
  fromSchedule = null,
  availableSchedules = [],
}) => {
  const isEdit = Boolean(existing);
  const [selectedScheduleId, setSelectedScheduleId] = useState(fromSchedule ? fromSchedule._id : '');
  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyForm,
        ...existing,
        dateRange: {
          start: toDateInput(existing.dateRange?.start),
          end: toDateInput(existing.dateRange?.end),
        },
        participants: existing.participants || [],
        externalDetails: {
          ...emptyForm.externalDetails,
          ...(existing.externalDetails || {}),
        },
      };
    }
    if (fromSchedule) {
      return {
        ...emptyForm,
        type: fromSchedule.targetType || 'Internal',
        title: fromSchedule.title || '',
        facilitator: fromSchedule.targetType === 'Internal' ? fromSchedule.facilitatorOrVendor || '' : '',
        description: fromSchedule.description || fromSchedule.note || '',
        dateRange: {
          start: toDateInput(fromSchedule.targetDate),
          end: toDateInput(fromSchedule.targetDate),
        },
        progress: 'Completed',
        externalDetails: {
          ...emptyForm.externalDetails,
          organizers: fromSchedule.category || '',
          cost: 'Free',
        },
      };
    }
    return { ...emptyForm, type: initialType };
  });

  const [roster, setRoster] = useState([]);
  const [participantInput, setParticipantInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    bdApi
      .getTeamRoster()
      .then((rows) => {
        if (!ignore) setRoster(rows.map((r) => r.name).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const handleSelectSchedule = (schedId) => {
    setSelectedScheduleId(schedId);
    if (!schedId) return;
    const sched = availableSchedules.find((s) => s._id === schedId);
    if (sched) {
      setForm((f) => ({
        ...f,
        title: sched.title || f.title,
        description: sched.note || f.description,
        dateRange: {
          start: toDateInput(sched.targetDate),
          end: toDateInput(sched.targetDate),
        },
        externalDetails: {
          ...f.externalDetails,
          organizers: sched.category || f.externalDetails.organizers,
        },
      }));
    }
  };

  const addParticipant = (name) => {
    const clean = (name || participantInput).trim();
    if (!clean) return;
    if (!form.participants.includes(clean)) {
      setForm((f) => ({ ...f, participants: [...f.participants, clean] }));
    }
    setParticipantInput('');
  };

  const removeParticipant = (name) => {
    setForm((f) => ({
      ...f,
      participants: f.participants.filter((p) => p !== name),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      return setError('Please provide a training title.');
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        dateRange: {
          start: form.dateRange.start ? new Date(form.dateRange.start) : null,
          end: form.dateRange.end ? new Date(form.dateRange.end) : null,
        },
      };

      let result;
      const targetScheduleId = fromSchedule?._id || selectedScheduleId;

      if (isEdit) {
        result = await bdApi.updateTraining(existing._id, payload);
      } else if (targetScheduleId) {
        const convertRes = await bdApi.convertScheduleToTraining(targetScheduleId, payload);
        result = convertRes.training;
      } else {
        result = await bdApi.addTraining(payload);
      }

      onSaved(result, targetScheduleId ? { _id: targetScheduleId } : null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Training: ${existing.title}` : 'Log Professional Training'}
      description="Record internal workshops or external vendor bootcamps for institutional capability."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {form.type === 'Internal' ? '🏢 Internal Upskilling Session' : '🌐 External Vendor Program'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" form="training-form" type="submit" disabled={busy}>
              {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Training Log'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="training-form" onSubmit={submit} className="space-y-5">
        {error && (
          <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {/* Optional Schedule Picker (Link with Calendar Awareness) */}
        {!isEdit && availableSchedules && availableSchedules.length > 0 && (
          <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl space-y-1.5 animate-fade-in">
            <label className="block text-xs font-bold text-navy-950 flex items-center gap-1.5">
              <span>📅</span> Link with a Scheduled Calendar Event / Roadmap (Optional)
            </label>
            <select
              value={selectedScheduleId}
              onChange={(e) => handleSelectSchedule(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-300 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">-- None (Log a fresh training) --</option>
              {availableSchedules
                .filter((s) => s.status !== 'Logged as Training')
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.category ? `[${s.category}] ` : ''}{s.title} &bull; ({formatDate(s.targetDate)})
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Selecting a scheduled item auto-fills its title, category, and date, and marks it completed on the calendar.
            </p>
          </div>
        )}

        {/* Type Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Training Scope & Type
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: 'Internal' }))}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                form.type === 'Internal'
                  ? 'bg-white text-navy-900 shadow-sm border border-slate-200/60 font-semibold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              🏢 Internal Workshop / Upskilling
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: 'External' }))}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                form.type === 'External'
                  ? 'bg-white text-navy-900 shadow-sm border border-slate-200/60 font-semibold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              🌐 External Bootcamp / Vendor
            </button>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {form.type === 'Internal' ? 'Training Title *' : 'Program / Course Title *'}
          </label>
          <input
            type="text"
            required
            placeholder={
              form.type === 'Internal'
                ? 'e.g., Q3 Technical Architecture & Bid Writing Session'
                : 'e.g., AWS Partner Technical Bootcamp 2026'
            }
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>

        {/* Internal Specific: Facilitator */}
        {form.type === 'Internal' ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Facilitator / Session Lead
            </label>
            <input
              type="text"
              placeholder="e.g., Nana K. / Senior Solutions Architect"
              value={form.facilitator}
              onChange={(e) => setForm((f) => ({ ...f, facilitator: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
          </div>
        ) : (
          /* External Specific: Organizers, Country/Modality, Cost */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Organizers / Vendor
              </label>
              <input
                type="text"
                placeholder="e.g., AWS Academy, Esri, SAP"
                value={form.externalDetails.organizers}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    externalDetails: { ...f.externalDetails, organizers: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Country / Modality
              </label>
              <input
                type="text"
                placeholder="e.g., Online, Accra, Nairobi"
                value={form.externalDetails.country || form.externalDetails.modality}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    externalDetails: {
                      ...f.externalDetails,
                      country: e.target.value,
                      modality: e.target.value,
                    },
                  }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cost & Sponsorship
              </label>
              <select
                value={form.externalDetails.cost || 'Free'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    externalDetails: { ...f.externalDetails, cost: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
              >
                {COST_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Date Range & Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={form.dateRange.start}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dateRange: { ...f.dateRange, start: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              End Date <span className="text-slate-400 font-normal">(Optional for single-day)</span>
            </label>
            <input
              type="date"
              value={form.dateRange.end}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dateRange: { ...f.dateRange, end: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Progress Status</label>
            <select
              value={form.progress}
              onChange={(e) => setForm((f) => ({ ...f, progress: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            >
              {PROGRESS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Participants Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Participants ({form.participants.length})
          </label>
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px]">
            {form.participants.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-50 border border-navy-100 text-navy-800 text-xs font-medium"
              >
                <span>👤</span>
                {p}
                <button
                  type="button"
                  onClick={() => removeParticipant(p)}
                  className="text-slate-400 hover:text-red-600 ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1 flex-1 min-w-[140px]">
              <input
                type="text"
                placeholder="Type or pick participant..."
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addParticipant();
                  }
                }}
                className="w-full bg-transparent text-xs text-navy-900 placeholder:text-slate-400 focus:outline-none px-1"
              />
              {participantInput && (
                <button
                  type="button"
                  onClick={() => addParticipant()}
                  className="px-2 py-0.5 text-xs bg-navy-700 text-white rounded font-medium"
                >
                  Add
                </button>
              )}
            </div>
          </div>
          {roster.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 items-center">
              <span className="text-[11px] text-slate-400 mr-1">Roster suggestions:</span>
              {roster.slice(0, 8).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addParticipant(name)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                    form.participants.includes(name)
                      ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-default'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-navy-400 hover:text-navy-900'
                  }`}
                  disabled={form.participants.includes(name)}
                >
                  + {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Brief Description & Covered Topics
          </label>
          <textarea
            rows={2}
            placeholder="Key skills, domain knowledge, toolsets covered..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>

        {/* Key Takeaways (Institutional Memory) */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Key Takeaways / Institutional Notes
          </label>
          <textarea
            rows={2}
            placeholder="Actionable insights, link to slides/recording, follow-up milestones..."
            value={form.takeaways}
            onChange={(e) => setForm((f) => ({ ...f, takeaways: e.target.value }))}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>
      </form>
    </Modal>
  );
};

export default TrainingFormModal;
