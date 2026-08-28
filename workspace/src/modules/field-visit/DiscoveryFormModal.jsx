import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/useDashboard';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import {
  SENTIMENTS,
  SENTIMENT_ICON,
  emptyDiscoveryForm,
  toDateInput,
  formatDate,
} from './fieldVisitConstants';

const DiscoveryFormModal = ({ open, onClose, onSaved, existing = null, defaultClient = '' }) => {
  const { currentUser, bumpClientData } = useDashboard();

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [planned, setPlanned] = useState([]);
  const [completing, setCompleting] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(() => {
    if (existing) {
      const details = existing.discoveryDetails || {};
      return {
        ...emptyDiscoveryForm,
        ...existing,
        client: existing.client?._id || existing.client || '',
        occurredAt: toDateInput(existing.occurredAt),
        teamAttendees: (existing.teamAttendees || []).join(', '),
        clientAttendees: (existing.clientAttendees || []).join(', '),
        durationMinutes: existing.durationMinutes || '60',
        operation: details.operation || '',
        personnel: details.personnel || '',
        contactEmail: details.contactEmail || existing.contactName || '',
        clientRequest: details.clientRequest || '',
        summary: details.summary || existing.observations || '',
        painPoints: details.painPoints?.length > 0 ? details.painPoints : [{ title: '', description: '' }],
        propositions: details.propositions?.length > 0 ? details.propositions : [{ title: '', description: '' }],
        usersCount: details.usersCount || '',
        processFlow: details.processFlow || '',
        additionalNotes: details.additionalNotes || '',
        commitmentDescription: '',
        commitmentDue: '',
      };
    }
    return {
      ...emptyDiscoveryForm,
      client: defaultClient,
      occurredAt: new Date().toISOString().slice(0, 10),
    };
  });

  useEffect(() => {
    let ignore = false;
    bdApi.getClients({ sort: 'name' })
      .then((list) => { if (!ignore) setClients(list); })
      .catch(() => { if (!ignore) setClients([]); })
      .finally(() => { if (!ignore) setLoadingClients(false); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    if (existing || !form.client) return undefined;
    bdApi.getFieldVisits({ client: form.client, visitStatus: 'Planned' })
      .then((rows) => { if (!ignore) setPlanned(rows); })
      .catch(() => { if (!ignore) setPlanned([]); });
    return () => { ignore = true; };
  }, [form.client, existing]);

  const pickPlanned = (id) => {
    setCompleting(id);
    if (!id) return;
    const visit = planned.find((v) => v._id === id);
    if (!visit) return;
    setForm((f) => ({
      ...f,
      locationName: visit.locationName || f.locationName,
      address: visit.address || f.address,
      occurredAt: toDateInput(visit.occurredAt) || f.occurredAt,
      teamAttendees: (visit.teamAttendees || []).join(', ') || f.teamAttendees,
      clientAttendees: (visit.clientAttendees || []).join(', ') || f.clientAttendees,
    }));
  };

  const update = (field) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'client') { setPlanned([]); setCompleting(''); }
  };

  // --- Dynamic Pain Point Handlers ---
  const handlePainPointChange = (index, key, value) => {
    setForm((f) => {
      const list = [...f.painPoints];
      list[index] = { ...list[index], [key]: value };
      return { ...f, painPoints: list };
    });
  };

  const addPainPoint = () => {
    setForm((f) => ({
      ...f,
      painPoints: [...f.painPoints, { title: '', description: '' }],
    }));
  };

  const removePainPoint = (index) => {
    setForm((f) => ({
      ...f,
      painPoints: f.painPoints.filter((_, i) => i !== index),
    }));
  };

  // --- Dynamic Proposition Handlers ---
  const handlePropositionChange = (index, key, value) => {
    setForm((f) => {
      const list = [...f.propositions];
      list[index] = { ...list[index], [key]: value };
      return { ...f, propositions: list };
    });
  };

  const addProposition = () => {
    setForm((f) => ({
      ...f,
      propositions: [...f.propositions, { title: '', description: '' }],
    }));
  };

  const removeProposition = (index) => {
    setForm((f) => ({
      ...f,
      propositions: f.propositions.filter((_, i) => i !== index),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return setError('Pick who you are in the top bar first — visits are attributed to that name.');
    if (!form.client) return setError('Pick which client this discovery session is for.');
    if (!form.locationName.trim()) return setError('Venue / Location name is required.');

    setSubmitting(true);
    try {
      const discoveryDetails = {
        operation: form.operation,
        personnel: form.personnel,
        contactEmail: form.contactEmail,
        clientRequest: form.clientRequest,
        summary: form.summary,
        painPoints: form.painPoints.filter((p) => p.title.trim() || p.description.trim()),
        propositions: form.propositions.filter((p) => p.title.trim() || p.description.trim()),
        usersCount: form.usersCount,
        processFlow: form.processFlow,
        additionalNotes: form.additionalNotes,
      };

      const payload = {
        ...form,
        visitType: 'Discovery',
        visitStatus: 'Completed',
        loggedBy: currentUser,
        commitmentOwner: currentUser,
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
        durationMinutes: form.durationMinutes || undefined,
        observations: form.summary || form.observations || 'Discovery session conducted.',
        purpose: form.clientRequest ? `Discovery: ${form.clientRequest}` : 'Discovery Session',
        discoveryDetails,
      };

      const target = existing?._id || completing;
      let saved = target
        ? await bdApi.updateFieldVisit(target, { ...payload, changedBy: currentUser })
        : await bdApi.addFieldVisit(payload);

      for (const file of photos) {
        try {
          saved = await bdApi.uploadVisitPhoto(saved._id, file);
        } catch (err) {
          setError(`Discovery session saved, but ${file.name} did not upload: ${err.message}`);
        }
      }

      bumpClientData();
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        Recorded by <strong className="text-navy-800">{currentUser || '—'}</strong>
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="discovery-form" disabled={submitting}>
          {submitting ? 'Saving Session…' : existing ? 'Save Discovery Changes' : 'Log Discovery Session'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={existing ? `Edit Discovery Session — ${existing.locationName}` : '📋 Log Discovery Session'}
      description="Record structured client requirements, pain points, proposed CRM/queue features, and process flows."
      footer={footer}
    >
      <form id="discovery-form" onSubmit={submit} className="space-y-6">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {!existing && planned.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2.5">
            <label className="form-label" htmlFor="discovery-completing">
              Is this the write-up of a planned visit?
            </label>
            <select
              id="discovery-completing"
              value={completing}
              onChange={(e) => pickPlanned(e.target.value)}
              className="form-input"
            >
              <option value="">No — this is a new discovery session</option>
              {planned.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.locationName} · {formatDate(v.occurredAt)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* --- Section 1: Overview & Logistics --- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
            <span>📍</span> Session Logistics & Contact Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Client <span className="text-red-600">*</span></label>
              <select value={form.client} onChange={update('client')} className="form-input" disabled={Boolean(existing)}>
                <option value="">{loadingClients ? 'Loading…' : 'Select a client…'}</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Discovery Date <span className="text-red-600">*</span></label>
              <input type="date" value={form.occurredAt} onChange={update('occurredAt')} className="form-input" />
            </div>
            <div>
              <label className="form-label">Venue / Location <span className="text-red-600">*</span></label>
              <input
                type="text" value={form.locationName} onChange={update('locationName')}
                placeholder="Main Office Spintex, etc." className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Operation / Industry</label>
              <input
                type="text" value={form.operation} onChange={update('operation')}
                placeholder="Auto Dealership & Servicing" className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Personnel / Department</label>
              <input
                type="text" value={form.personnel} onChange={update('personnel')}
                placeholder="Customer Service (Front Desk & Client Engagement)" className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Client Request Scope</label>
              <input
                type="text" value={form.clientRequest} onChange={update('clientRequest')}
                placeholder="Queuing System & Custom CRM" className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Contact Person (Lead)</label>
              <input
                type="text" value={form.clientAttendees} onChange={update('clientAttendees')}
                placeholder="Deejay (Lead)" className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Contact Email</label>
              <input
                type="email" value={form.contactEmail} onChange={update('contactEmail')}
                placeholder="info@swissgroupauto.com" className="form-input"
              />
            </div>
            <div>
              <label className="form-label">TGTS Team Staff</label>
              <input
                type="text" value={form.teamAttendees} onChange={update('teamAttendees')}
                placeholder="Nana Boakye, Nii, Nelly" className="form-input"
              />
            </div>
          </div>
        </div>

        {/* --- Section 2: Executive Summary --- */}
        <div className="space-y-2">
          <label className="form-label font-semibold text-navy-900 flex items-center gap-1.5">
            <span>📝</span> Discovery Summary & Client Background
          </label>
          <textarea
            value={form.summary}
            onChange={update('summary')}
            rows={3}
            placeholder="Swiss Auto Dealer and Servicing (Swiss Group) is struggling with a lack of a centralized system to manage clients, visitors, and ongoing communications..."
            className="form-input"
          />
        </div>

        {/* --- Section 3: Pain Points & Challenges --- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
              <span>⚠️</span> Pain Points & Current Challenges ({form.painPoints.length})
            </h4>
            <button
              type="button"
              onClick={addPainPoint}
              className="text-xs font-medium text-purple-700 hover:text-purple-900 cursor-pointer"
            >
              + Add Pain Point
            </button>
          </div>

          <div className="space-y-2">
            {form.painPoints.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handlePainPointChange(idx, 'title', e.target.value)}
                  placeholder="Pain Point (e.g. Delayed Operations)"
                  className="form-input text-xs sm:w-1/3 font-semibold text-navy-900"
                />
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handlePainPointChange(idx, 'description', e.target.value)}
                  placeholder="Detailed description of current challenge"
                  className="form-input text-xs sm:w-2/3"
                />
                <button
                  type="button"
                  onClick={() => removePainPoint(idx)}
                  className="text-slate-400 hover:text-red-700 text-sm px-1 self-center cursor-pointer"
                  title="Remove Pain Point"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- Section 4: Proposed Needs & System Solutions --- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span>💡</span> Proposed Solutions & System Needs ({form.propositions.length})
            </h4>
            <button
              type="button"
              onClick={addProposition}
              className="text-xs font-medium text-purple-700 hover:text-purple-900 cursor-pointer"
            >
              + Add Proposed Need
            </button>
          </div>

          <div className="space-y-2">
            {form.propositions.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handlePropositionChange(idx, 'title', e.target.value)}
                  placeholder="Proposition / Module (e.g. Centralised CRM)"
                  className="form-input text-xs sm:w-1/3 font-semibold text-navy-900"
                />
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handlePropositionChange(idx, 'description', e.target.value)}
                  placeholder="Feature requirement or description"
                  className="form-input text-xs sm:w-2/3"
                />
                <button
                  type="button"
                  onClick={() => removeProposition(idx)}
                  className="text-slate-400 hover:text-red-700 text-sm px-1 self-center cursor-pointer"
                  title="Remove Need"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- Section 5: Operations & Process Flow --- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
          <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
            <span>⚙️</span> Operational Flow & User Count
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">System Users Count</label>
              <input
                type="text"
                value={form.usersCount}
                onChange={update('usersCount')}
                placeholder="e.g. 5 people"
                className="form-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Process Flow (Mini steps)</label>
              <input
                type="text"
                value={form.processFlow}
                onChange={update('processFlow')}
                placeholder="Register -> Received -> Servicing -> Quality checks -> Washing -> Completed"
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Additional Notes / Parts</label>
            <input
              type="text"
              value={form.additionalNotes}
              onChange={update('additionalNotes')}
              placeholder="e.g. AC filter & Oil Filter will be changed"
              className="form-input"
            />
          </div>
        </div>

        {/* --- Section 6: Photos, Sentiment & Commitments --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Site / Workflow Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              className="text-sm"
            />
            {photos.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{photos.length} photo(s) selected for upload.</p>
            )}
          </div>

          <div>
            <label className="form-label">Client Sentiment</label>
            <div className="flex gap-1.5">
              {SENTIMENTS.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => setForm((f) => ({ ...f, sentiment: s }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${form.sentiment === s
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'
                    }`}
                >
                  {SENTIMENT_ICON[s]} {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!existing && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
            <p className="text-xs font-semibold text-navy-900">Did you promise any action item during discovery?</p>
            <input
              type="text" value={form.commitmentDescription}
              onChange={update('commitmentDescription')}
              placeholder="e.g. Send formal CRM proposal & technical scope by Friday" className="form-input"
            />
            {form.commitmentDescription.trim() && (
              <div>
                <label className="form-label">By when</label>
                <input type="date" value={form.commitmentDue} onChange={update('commitmentDue')} className="form-input" />
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default DiscoveryFormModal;
