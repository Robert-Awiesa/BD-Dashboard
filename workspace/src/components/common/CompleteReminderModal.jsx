import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

const CompleteReminderModal = ({ open, onClose, reminder, onCompleted }) => {
  const [completionNotes, setCompletionNotes] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [completedBy, setCompletedBy] = useState(reminder?.responsiblePerson || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!reminder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCompleted(reminder._id, {
        completionNotes: completionNotes.trim(),
        deliverables: deliverables.trim(),
        completedBy,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete task');
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
        {submitting ? 'Archiving Alert…' : '✅ Mark Met & Log Metrics'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✅ Mark Met & Log Completion Metrics"
      description={`${reminder.sourceType} · ${reminder.sourceLabel}`}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1">
          <p className="font-semibold text-emerald-900">Task Met Ahead of Deadline:</p>
          <p className="text-emerald-800">{reminder.message}</p>
          <p className="text-[11px] text-emerald-700">
            Log execution outputs and metrics to archive this notification without delay penalties.
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Completion Notes / Executive Summary</label>
          <textarea
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            rows={3}
            placeholder="Record key outcomes, meeting summary, or performance insights..."
            className="w-full form-input text-xs"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Deliverables & Output Links</label>
          <input
            type="text"
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            placeholder="e.g. Document URL, signed contract link, campaign metrics link"
            className="w-full form-input text-xs"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Completed By</label>
          <input
            type="text"
            value={completedBy}
            onChange={(e) => setCompletedBy(e.target.value)}
            placeholder="Your Name or Team"
            className="w-full form-input text-xs"
          />
        </div>

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

export default CompleteReminderModal;
