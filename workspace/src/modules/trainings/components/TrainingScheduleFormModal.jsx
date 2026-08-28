import { useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { bdApi } from '../../../context/services/api';

const CATEGORIES = ['AWS', 'SAP', 'Esri', 'OpenText', 'BD / Tender', 'General Tech', 'Other'];
const GROUP_PRESETS = [
  'All Technical Staff',
  'Solutions Architects',
  'GIS & Spatial Team',
  'BD & Tender Managers',
  'Software Engineers',
  'Whole Company',
];

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const emptyForm = {
  title: '',
  category: 'AWS',
  targetDate: '',
  targetGroup: 'All Technical Staff',
  note: '',
};

const TrainingScheduleFormModal = ({ open, onClose, onSaved, existing = null, defaultDate = null }) => {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(() =>
    existing
      ? {
          ...emptyForm,
          ...existing,
          targetDate: toDateInput(existing.targetDate),
        }
      : {
          ...emptyForm,
          targetDate: defaultDate ? toDateInput(defaultDate) : toDateInput(new Date()),
        }
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      return setError('Please enter a brief title or theme for the training awareness.');
    }
    if (!form.targetDate) {
      return setError('Please pick a target date.');
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        targetDate: new Date(form.targetDate),
      };

      const result = isEdit
        ? await bdApi.updateTrainingSchedule(existing._id, payload)
        : await bdApi.addTrainingSchedule(payload);

      onSaved(result);
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
      title={isEdit ? 'Edit Training Schedule' : '📅 Add Training Awareness on Calendar'}
      description="Quickly place an upcoming training theme, vendor bootcamp window, or tech session on the team roadmap."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" form="quick-schedule-form" type="submit" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save Changes' : '+ Add to Calendar'}
          </Button>
        </div>
      }
    >
      <form id="quick-schedule-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {/* Category Pill Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Ecosystem / Category *
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const isSelected = form.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-navy-900 text-white border-navy-900 shadow-2xs font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-navy-900'
                  }`}
                >
                  {cat === 'AWS' && '☁️ AWS'}
                  {cat === 'SAP' && '🏢 SAP'}
                  {cat === 'Esri' && '🗺️ Esri'}
                  {cat === 'OpenText' && '📁 OpenText'}
                  {cat === 'BD / Tender' && '🏛️ BD / Tender'}
                  {cat === 'General Tech' && '💻 Tech Sharing'}
                  {cat === 'Other' && '✨ Other'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Training Theme / Occasion *
          </label>
          <input
            type="text"
            required
            placeholder="e.g., AWS Security & Compliance Month or SAP S/4HANA Overview"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>

        {/* Target Date */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Target Date / Month *
          </label>
          <input
            type="date"
            required
            value={form.targetDate}
            onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>

        {/* Target Group / Who should know */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Who Should Be Aware? (Target Group)
          </label>
          <input
            type="text"
            value={form.targetGroup}
            onChange={(e) => setForm((f) => ({ ...f, targetGroup: e.target.value }))}
            placeholder="e.g., Solutions Architects, Whole Team"
            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {GROUP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setForm((f) => ({ ...f, targetGroup: preset }))}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-navy-50 hover:text-navy-900"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Note / Link / Reminder */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Quick Heads-Up / Reminder Note <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g., Registration opens April 1st; virtual session link to follow."
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>
      </form>
    </Modal>
  );
};

export default TrainingScheduleFormModal;
