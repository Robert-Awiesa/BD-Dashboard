import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { MILESTONE_TYPES, MONTHS, DAYS_IN_MONTH, emptyMilestoneForm } from './eventConstants';

// Tenure only means something for anniversaries/partnerships; birthdays
// deliberately don't require a birth year.
const NEEDS_ORIGIN = ['Work Anniversary', 'Partner Milestone'];

const MilestoneModal = ({ open, onClose, onSubmit, submitting, initialData }) => {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          ...emptyMilestoneForm,
          ...initialData,
          originalStartDate: initialData.originalStartDate ? String(initialData.originalStartDate).slice(0, 10) : '',
        }
      : emptyMilestoneForm
  );
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(emptyMilestoneForm);
    setError(null);
    onClose();
  };

  const maxDay = DAYS_IN_MONTH[Number(form.milestoneMonth) - 1] || 31;

  const submit = async () => {
    if (!form.participantName.trim()) return setError('Name is required.');
    if (Number(form.milestoneDay) > maxDay) {
      return setError(`${MONTHS[form.milestoneMonth - 1]} has at most ${maxDay} days.`);
    }
    try {
      await onSubmit({
        ...form,
        milestoneMonth: Number(form.milestoneMonth),
        milestoneDay: Number(form.milestoneDay),
        originalStartDate: form.originalStartDate || null,
      });
      handleClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
      <Button type="button" variant="primary" onClick={submit} disabled={submitting}>
        {submitting ? 'Saving...' : initialData ? 'Update Milestone' : 'Add Milestone'}
      </Button>
    </div>
  );

  const isExternal = form.milestoneType === 'Partner Milestone' || form.milestoneType === 'VIP Stakeholder Birthday';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialData ? 'Edit Milestone' : 'New Milestone'}
      description="Recurs every year — no annual reset needed."
      footer={footer}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Milestone Type</label>
          <select value={form.milestoneType} onChange={set('milestoneType')} className="w-full form-input">
            {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Name *</label>
            <input type="text" value={form.participantName} onChange={set('participantName')} className="w-full form-input" placeholder={isExternal ? 'e.g. Acme Corp' : 'e.g. Sarah Jenkins'} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">{isExternal ? 'Organization' : 'Department'}</label>
            <input type="text" value={form.departmentOrCompany} onChange={set('departmentOrCompany')} className="w-full form-input" />
          </div>
        </div>

        {!isExternal && (
          <div>
            <label className="block text-xs text-slate-600 mb-1">Role</label>
            <input type="text" value={form.role} onChange={set('role')} className="w-full form-input" placeholder="e.g. Business Development Manager" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Month</label>
            <select value={form.milestoneMonth} onChange={set('milestoneMonth')} className="w-full form-input">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Day</label>
            <select value={form.milestoneDay} onChange={set('milestoneDay')} className="w-full form-input">
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {NEEDS_ORIGIN.includes(form.milestoneType) ? 'Start Date (for tenure)' : 'Start Date (optional)'}
            </label>
            <input type="date" value={form.originalStartDate} onChange={set('originalStartDate')} className="w-full form-input" />
          </div>
        </div>

        {!isExternal && (
          <div>
            <label className="block text-xs text-slate-600 mb-1">Favourite Quote</label>
            <input type="text" value={form.favouriteQuote} onChange={set('favouriteQuote')} className="w-full form-input" />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full form-input resize-y" placeholder="Gift ideas, contract renewal context, etc." />
        </div>

        {form.milestoneMonth === 2 && Number(form.milestoneDay) === 29 && (
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-sky-800 text-xs">
            Leap-year date noted — this will be observed on 28 February in non-leap years so it is never skipped.
          </div>
        )}

        {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      </div>
    </Modal>
  );
};

export default MilestoneModal;
