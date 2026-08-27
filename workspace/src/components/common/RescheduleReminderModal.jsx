import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const RescheduleReminderModal = ({ open, onClose, reminder, onRescheduled }) => {
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [rescheduledBy, setRescheduledBy] = useState(reminder?.responsiblePerson || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!reminder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setError('Please select a new target deadline date.');
      return;
    }
    if (!reason.trim()) {
      setError('A mandatory reason for delay is required to maintain team transparency.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onRescheduled(reminder._id, { newDate, reason: reason.trim(), rescheduledBy });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>
      <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Updating Schedule…' : 'Confirm Reschedule'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📅 Reschedule Deadline"
      description={`${reminder.sourceType} · ${reminder.sourceLabel}`}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
          <p className="font-semibold text-amber-900">Current Notice:</p>
          <p className="text-amber-800">{reminder.message}</p>
          {reminder.responsiblePerson && (
            <p className="text-[11px] text-amber-700">Assigned Owner: {reminder.responsiblePerson}</p>
          )}
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            New Target Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full form-input text-xs"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Reason for Delay <span className="text-red-500">* (Mandatory for team transparency)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this deadline is moving (e.g. Waiting on partner response, scope revision)..."
            className="w-full form-input text-xs"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Rescheduled By</label>
          <input
            type="text"
            value={rescheduledBy}
            onChange={(e) => setRescheduledBy(e.target.value)}
            placeholder="Your Name or Department"
            className="w-full form-input text-xs"
          />
        </div>

        {/* Audit History Timeline */}
        {reminder.rescheduleHistory && reminder.rescheduleHistory.length > 0 && (
          <div className="border-t border-slate-200 pt-3 space-y-1.5">
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
              📜 Previous Reschedule Audit Trail ({reminder.rescheduleHistory.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {reminder.rescheduleHistory.map((h, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px]">
                  <div className="flex justify-between font-medium text-slate-800">
                    <span>{formatDate(h.previousDate)} ➔ {formatDate(h.newDate)}</span>
                    <span className="text-slate-500">{formatDate(h.rescheduledAt)}</span>
                  </div>
                  <p className="text-slate-600 italic mt-0.5">&ldquo;{h.reason}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}

        <button type="submit" className="hidden" tabIndex={-1} />
      </form>
    </Modal>
  );
};

export default RescheduleReminderModal;
