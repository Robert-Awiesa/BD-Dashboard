import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { INDUSTRY_OPTIONS, CALL_OUTCOMES, emptyColdCallForm } from './coldCallConstants';

const ColdCallModal = ({ open, onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState(emptyColdCallForm);
  const [error, setError] = useState(null);

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(emptyColdCallForm);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.prospectName.trim() || !form.phoneNumber.trim()) {
      setError('Prospect Name and Phone Number are required.');
      return;
    }
    if (form.industry === 'Others' && !form.customIndustry.trim()) {
      setError('Please specify the industry.');
      return;
    }
    try {
      await onSubmit(form);
      setForm(emptyColdCallForm);
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
      <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Logging...' : 'Log Call'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Log Cold Call"
      description="Fast-entry log for outbound call activity"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company / Prospect Name *</label>
            <input
              type="text"
              required
              autoFocus
              value={form.prospectName}
              onChange={updateForm('prospectName')}
              className="w-full form-input"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              value={form.phoneNumber}
              onChange={updateForm('phoneNumber')}
              className="w-full form-input"
              placeholder="+1 555 0100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Industry</label>
            <select value={form.industry} onChange={updateForm('industry')} className="w-full form-input">
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {form.industry === 'Others' ? (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Please specify industry</label>
              <input
                type="text"
                value={form.customIndustry}
                onChange={updateForm('customIndustry')}
                className="w-full form-input"
                placeholder="Specify industry"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Call Outcome</label>
              <select value={form.callOutcome} onChange={updateForm('callOutcome')} className="w-full form-input">
                {CALL_OUTCOMES.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {form.industry === 'Others' && (
          <div>
            <label className="block text-xs text-slate-600 mb-1">Call Outcome</label>
            <select value={form.callOutcome} onChange={updateForm('callOutcome')} className="w-full form-input">
              {CALL_OUTCOMES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-600 mb-1">Key Objection / Notes</label>
          <textarea
            value={form.notes}
            onChange={updateForm('notes')}
            rows={2}
            className="w-full form-input resize-none"
            placeholder='e.g. "Using a competitor contract until Q4", "Send info deck via email"'
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Follow-Up Date & Time</label>
            <input
              type="datetime-local"
              value={form.followUpAt}
              onChange={updateForm('followUpAt')}
              className="w-full form-input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Assigned Agent</label>
            <input
              type="text"
              value={form.assignedAgent}
              onChange={updateForm('assignedAgent')}
              className="w-full form-input"
              placeholder="e.g. Thabo M."
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
        )}

        {/* Keeps Enter-to-submit working now that the real button lives in the pinned footer. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

export default ColdCallModal;
