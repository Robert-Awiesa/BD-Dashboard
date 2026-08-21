import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ProspectingModal from './ProspectingModal';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const displayIndustry = (lead) => (lead.industry === 'Others' && lead.customIndustry ? lead.customIndustry : lead.industry);

const ProspectingLeadsModule = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [search, setSearch] = useState('');

  const refreshLeads = async () => {
    try {
      const data = await bdApi.getProspectingLeads();
      setLeads(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load prospecting leads:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    let ignore = false;
    bdApi.getProspectingLeads()
      .then((data) => {
        if (!ignore) setLeads(data);
      })
      .catch((err) => {
        console.error('Failed to load prospecting leads:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmitManual = async (form) => {
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.industry !== 'Others') payload.customIndustry = '';
      if (editingLead) {
        const saved = await bdApi.updateProspectingLead(editingLead._id, payload);
        setLeads((prev) => prev.map((l) => (l._id === saved._id ? saved : l)));
        setSelectedLead((cur) => (cur && cur._id === saved._id ? saved : cur));
        setEditingLead(null);
      } else {
        const newLead = await bdApi.addProspectingLead(payload);
        setLeads((prev) => [newLead, ...prev]);
      }
      setShowModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBulk = async (rows) => {
    setSubmitting(true);
    try {
      const result = await bdApi.bulkAddProspectingLeads(rows);
      setShowModal(false);
      await refreshLeads();
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this prospecting lead?')) return;
    try {
      await bdApi.deleteProspectingLead(id);
      setLeads((prev) => prev.filter((l) => l._id !== id));
      setSelectedLead(null);
    } catch (err) {
      alert(`Error deleting lead: ${err.message}`);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      lead.company?.toLowerCase().includes(q) ||
      lead.contactPerson?.toLowerCase().includes(q) ||
      lead.location?.toLowerCase().includes(q) ||
      displayIndustry(lead)?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Prospecting Leads</h2>
          <p className="text-sm text-slate-600">Log, categorize, and track outbound prospects.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, industry..."
            className="form-input text-sm w-56"
          />
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + New Pipeline Item
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton" />)}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to connect to backend: {error}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          {leads.length === 0 ? 'No prospecting leads yet. Click "+ New Pipeline Item" to add one.' : 'No leads match your search.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Contact Person</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Industry</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Opportunity Stage</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Primary Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy-800 whitespace-nowrap">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy-900 whitespace-nowrap">{lead.company}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{lead.contactPerson}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{displayIndustry(lead)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge label={lead.opportunityStage} status={lead.opportunityStage} />
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{lead.primaryEmail}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{lead.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProspectingModal
        key={editingLead?._id || 'new'}
        open={showModal}
        onClose={() => { setShowModal(false); setEditingLead(null); }}
        onSubmitManual={handleSubmitManual}
        onSubmitBulk={handleSubmitBulk}
        submitting={submitting}
        editing={editingLead}
      />

      <Modal open={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead?.company}>
        {selectedLead && (
          <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-2">
              <Badge label={displayIndustry(selectedLead)} status="active" />
              <Badge label={selectedLead.opportunityStage} status={selectedLead.opportunityStage} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Contact Person</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.contactPerson || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Position</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.position || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Primary Email</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.primaryEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Other Email</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.otherEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Primary Contact</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.primaryContact || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Other Contact</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.otherContact || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">LinkedIn</dt>
                <dd className="text-slate-700 mt-0.5 break-all">{selectedLead.linkedin || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Company Website</dt>
                <dd className="text-slate-700 mt-0.5 break-all">{selectedLead.companyWebsite || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Location</dt>
                <dd className="text-slate-700 mt-0.5">{selectedLead.location || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide">Logged</dt>
                <dd className="text-slate-700 mt-0.5">{formatDate(selectedLead.createdAt)}</dd>
              </div>
            </dl>

            {selectedLead.companyChallenge && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Company Challenge</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedLead.companyChallenge}</dd>
              </div>
            )}
            {selectedLead.proposedSolution && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Proposed Solution</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedLead.proposedSolution}</dd>
              </div>
            )}
            {selectedLead.strategicAngle && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Strategic Angle</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedLead.strategicAngle}</dd>
              </div>
            )}
            {selectedLead.discoveryQuestions && (
              <div>
                <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">Discovery Questions</dt>
                <dd className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-line">{selectedLead.discoveryQuestions}</dd>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="danger" onClick={() => handleDelete(selectedLead._id)}>
                🗑️ Delete Lead
              </Button>
              <Button
                variant="primary"
                onClick={() => { setEditingLead(selectedLead); setShowModal(true); }}
              >
                ✎ Edit Lead
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProspectingLeadsModule;
