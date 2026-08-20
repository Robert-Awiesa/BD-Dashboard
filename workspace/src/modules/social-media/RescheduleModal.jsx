import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';

const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// Keyed by campaign._id from the parent, so state re-derives on campaign switch.
const RescheduleModal = ({ open, onClose, campaign, onSubmit, submitting }) => {
  const [startDate, setStartDate] = useState(() => toDateInputValue(campaign?.startDate));
  const [endDate, setEndDate] = useState(() => toDateInputValue(campaign?.endDate));
  const [error, setError] = useState(null);

  if (!campaign) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Both dates are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date.');
      return;
    }
    try {
      await onSubmit(campaign._id, { startDate, endDate });
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving...' : 'Reschedule Campaign'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule Campaign"
      description={campaign.campaignName}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          This campaign's window has passed without completed metrics. Pick a new launch window — the strategy details stay unchanged.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">New Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full form-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">New End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full form-input" />
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

export default RescheduleModal;
