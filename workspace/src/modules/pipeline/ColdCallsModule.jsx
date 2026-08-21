import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ColdCallModal from './ColdCallModal';
import { CALL_OUTCOME_SHORT_LABEL } from './coldCallConstants';

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const isOverdueFollowUp = (value) => {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
};

const displayIndustry = (call) => (call.industry === 'Others' && call.customIndustry ? call.customIndustry : call.industry);

const ColdCallsModule = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCall, setSelectedCall] = useState(null);
  const [editingCall, setEditingCall] = useState(null);
  const [search, setSearch] = useState('');
  const [convertError, setConvertError] = useState(null);

  useEffect(() => {
    let ignore = false;
    bdApi.getColdCalls()
      .then((data) => {
        if (!ignore) setCalls(data);
      })
      .catch((err) => {
        console.error('Failed to load cold calls:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        followUpAt: form.followUpAt || null,
      };
      if (payload.industry !== 'Others') payload.customIndustry = '';
      if (editingCall) {
        const saved = await bdApi.updateColdCall(editingCall._id, payload);
        setCalls((prev) => prev.map((c) => (c._id === saved._id ? saved : c)));
        setSelectedCall((cur) => (cur && cur._id === saved._id ? saved : cur));
        setEditingCall(null);
      } else {
        const newCall = await bdApi.addColdCall(payload);
        setCalls((prev) => [newCall, ...prev]);
      }
      setShowModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cold call log?')) return;
    try {
      await bdApi.deleteColdCall(id);
      setCalls((prev) => prev.filter((c) => c._id !== id));
      setSelectedCall(null);
    } catch (err) {
      alert(`Error deleting call: ${err.message}`);
    }
  };

  const handleConvert = async (call) => {
    setConvertError(null);
    const primaryEmail = window.prompt(`Primary email for ${call.prospectName} (required to create the Prospecting Lead):`, '');
    if (primaryEmail === null) return;
    if (!primaryEmail.trim()) {
      setConvertError('A primary email is required to convert to a Prospecting Lead.');
      return;
    }
    try {
      const { call: updatedCall } = await bdApi.convertColdCallToProspectingLead(call._id, { primaryEmail: primaryEmail.trim() });
      setCalls((prev) => prev.map((c) => (c._id === updatedCall._id ? updatedCall : c)));
      setSelectedCall((prev) => (prev && prev._id === updatedCall._id ? updatedCall : prev));
      alert(`${call.prospectName} has been added to Prospecting Leads.`);
    } catch (err) {
      setConvertError(err.message);
    }
  };

  const filteredCalls = calls.filter((call) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      call.prospectName?.toLowerCase().includes(q) ||
      call.phoneNumber?.toLowerCase().includes(q) ||
      call.assignedAgent?.toLowerCase().includes(q) ||
      displayIndustry(call)?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Cold Calls</h2>
          <p className="text-sm text-slate-600">Fast-entry log for outbound call activity and follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospect, phone, agent..."
            className="form-input text-sm w-56"
          />
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + Log Cold Call
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to connect to backend: {error}
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          {calls.length === 0 ? 'No cold calls logged yet. Click "+ Log Cold Call" to add one.' : 'No calls match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCalls.map((call) => {
            const overdue = isOverdueFollowUp(call.followUpAt);
            return (
              <div
                key={call._id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-navy-300 transition-colors flex flex-col gap-2.5"
              >
                <button
                  type="button"
                  onClick={() => setSelectedCall(call)}
                  className="text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-navy-900 text-sm">{call.prospectName}</span>
                    <Badge label={CALL_OUTCOME_SHORT_LABEL[call.callOutcome] || call.callOutcome} status={call.callOutcome} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">📞 {call.phoneNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{displayIndustry(call)}</p>
                  <p className="text-xs text-slate-500 mt-1">🕐 {formatDateTime(call.createdAt)}</p>
                  {call.followUpAt && (
                    <p className={`text-xs mt-1 ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {overdue ? '⚠ Follow-up overdue: ' : '📅 Follow-up: '}{formatDateTime(call.followUpAt)}
                    </p>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {call.convertedToProspectingLead ? (
                    <span className="text-xs font-medium text-forest-700">✓ Converted to Lead</span>
                  ) : call.callOutcome === 'Connected - Interested' ? (
                    <Button
                      variant="success"
                      className="text-xs px-2.5 py-1.5"
                      onClick={() => handleConvert(call)}
                    >
                      Convert to Prospecting Lead
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="text-xs px-2.5 py-1.5"
                      onClick={() => setSelectedCall(call)}
                    >
                      Log Follow-up
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {convertError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{convertError}</div>
      )}

      <ColdCallModal
        key={editingCall?._id || 'new'}
        open={showModal}
        onClose={() => { setShowModal(false); setEditingCall(null); }}
        onSubmit={handleSubmit}
        submitting={submitting}
        editing={editingCall}
      />

      <Modal open={!!selectedCall} onClose={() => setSelectedCall(null)} title={selectedCall?.prospectName}>
        {selectedCall && (
          <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-2">
              <Badge label={displayIndustry(selectedCall)} status="active" />
              <Badge label={selectedCall.callOutcome} status={selectedCall.callOutcome} />
              {selectedCall.convertedToProspectingLead && (
                <Badge label="Converted to Lead" status="success" />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Phone Number</dt>
                <dd className="text-slate-700 mt-0.5">{selectedCall.phoneNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Assigned Agent</dt>
                <dd className="text-slate-700 mt-0.5">{selectedCall.assignedAgent || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Follow-Up</dt>
                <dd className={`mt-0.5 ${isOverdueFollowUp(selectedCall.followUpAt) ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                  {formatDateTime(selectedCall.followUpAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Logged</dt>
                <dd className="text-slate-700 mt-0.5">{formatDateTime(selectedCall.createdAt)}</dd>
              </div>
            </dl>

            {selectedCall.notes && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Key Objection / Notes</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedCall.notes}</dd>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              {!selectedCall.convertedToProspectingLead && selectedCall.callOutcome === 'Connected - Interested' ? (
                <Button variant="success" onClick={() => handleConvert(selectedCall)}>
                  Convert to Prospecting Lead
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => handleDelete(selectedCall._id)}>
                  🗑️ Delete Call
                </Button>
                <Button
                  variant="primary"
                  onClick={() => { setEditingCall(selectedCall); setShowModal(true); }}
                >
                  ✎ Edit Call
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ColdCallsModule;
