import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { SENTIMENTS, SENTIMENT_ICON, emptyVisitForm, toDateInput, formatDate } from './fieldVisitConstants';

/**
 * One form, two jobs:
 *   - plan  : booking a trip that has not happened yet (date + where + why)
 *   - log   : writing up a trip that has (adds what was found)
 * Editing an existing visit picks the mode from its status.
 */
const VisitFormModal = ({ open, onClose, onSaved, existing = null, mode = 'log', defaultClient = '' }) => {
  const { currentUser, bumpClientData } = useDashboard();
  const planning = existing ? existing.visitStatus === 'Planned' : mode === 'plan';

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  // Trips already booked for the chosen client that nobody has written up.
  const [planned, setPlanned] = useState([]);
  // Which one this write-up completes. Empty means it is a fresh visit.
  const [completing, setCompleting] = useState('');
  // Photos are staged here and uploaded once the visit has an id — a brand-new
  // visit does not have one until it is saved.
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyVisitForm,
        ...existing,
        client: existing.client?._id || existing.client || '',
        occurredAt: toDateInput(existing.occurredAt),
        teamAttendees: (existing.teamAttendees || []).join(', '),
        clientAttendees: (existing.clientAttendees || []).join(', '),
        durationMinutes: existing.durationMinutes || '',
        commitmentDescription: '',
        commitmentDue: '',
      };
    }
    return {
      ...emptyVisitForm,
      client: defaultClient,
      visitStatus: mode === 'plan' ? 'Planned' : 'Completed',
      // A planned trip defaults to tomorrow; a write-up defaults to today.
      occurredAt: mode === 'plan'
        ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
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

  const update = (field) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [field]: value }));
    // A different client has different booked trips, so any pick is stale.
    if (field === 'client') { setPlanned([]); setCompleting(''); }
  };

  // A write-up is usually the write-up OF something already booked. Offer those
  // trips rather than making people retype what planning already captured —
  // and complete that record instead of leaving a planned twin behind.
  useEffect(() => {
    let ignore = false;
    if (planning || existing || !form.client) return undefined;
    bdApi.getFieldVisits({ client: form.client, visitStatus: 'Planned' })
      .then((rows) => { if (!ignore) setPlanned(rows); })
      .catch(() => { if (!ignore) setPlanned([]); });
    return () => { ignore = true; };
  }, [form.client, planning, existing]);

  const pickPlanned = (id) => {
    setCompleting(id);
    if (!id) return;
    const visit = planned.find((v) => v._id === id);
    if (!visit) return;
    // Carry across everything planning already answered; the write-up fields
    // stay as typed so nothing entered before choosing is lost.
    setForm((f) => ({
      ...f,
      locationName: visit.locationName || f.locationName,
      address: visit.address || f.address,
      purpose: visit.purpose || f.purpose,
      occurredAt: toDateInput(visit.occurredAt) || f.occurredAt,
      teamAttendees: (visit.teamAttendees || []).join(', ') || f.teamAttendees,
      clientAttendees: (visit.clientAttendees || []).join(', ') || f.clientAttendees,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return setError('Pick who you are in the top bar first — visits are attributed to that name.');
    if (!form.client) return setError('Pick which client this visit is for.');
    if (!form.locationName.trim()) return setError('Where did you go? A site or location name is required.');

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        loggedBy: currentUser,
        commitmentOwner: currentUser,
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
        durationMinutes: form.durationMinutes || undefined,
      };
      // Writing up a booked trip updates THAT visit, so the plan and the
      // write-up stay one record with one history rather than two rows.
      const target = existing?._id || completing;
      let saved = target
        ? await bdApi.updateFieldVisit(target, { ...payload, changedBy: currentUser })
        : await bdApi.addFieldVisit(payload);

      // One request each, so a single bad file does not lose the rest — or the
      // write-up, which is already saved by this point.
      for (const file of photos) {
        try {
          saved = await bdApi.uploadVisitPhoto(saved._id, file);
        } catch (err) {
          setError(`Visit saved, but ${file.name} did not upload: ${err.message}`);
        }
      }
      // A visit is a client touch, so the client module's data is now stale.
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
        <Button variant="primary" type="submit" form="visit-form" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : planning ? 'Book the visit' : 'Log the visit'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={existing ? `Edit visit — ${existing.locationName}` : planning ? 'Plan a site visit' : 'Log a site visit'}
      description={
        planning
          ? 'Book the trip now; write it up after. It shows on the client timeline once completed.'
          : 'Recorded against the client, so it appears on their timeline alongside every other touch.'
      }
      footer={footer}
    >
      <form id="visit-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {!planning && !existing && planned.length > 0 && (
          <div className="rounded-lg border border-navy-200 bg-navy-50/60 px-3 py-2.5">
            <label className="form-label" htmlFor="visit-completing">
              Is this the write-up of a booked trip?
            </label>
            <select
              id="visit-completing"
              value={completing}
              onChange={(e) => pickPlanned(e.target.value)}
              className="form-input"
            >
              <option value="">No — this is a new visit</option>
              {planned.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.locationName} · {formatDate(v.occurredAt)}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600 mt-1">
              {completing
                ? 'The details you booked are filled in below. Saving writes up that trip rather than adding a second one.'
                : `${planned.length} trip${planned.length === 1 ? '' : 's'} booked for this client and not yet written up.`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Client <span className="text-red-600">*</span></label>
            <select value={form.client} onChange={update('client')} className="form-input" disabled={Boolean(existing)}>
              <option value="">{loadingClients ? 'Loading…' : 'Select a client…'}</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {!loadingClients && clients.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No clients yet — add one in Client Relations first.
              </p>
            )}
          </div>
          <div>
            <label className="form-label">{planning ? 'Planned date' : 'Date of visit'} <span className="text-red-600">*</span></label>
            <input type="date" value={form.occurredAt} onChange={update('occurredAt')} className="form-input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Site / location <span className="text-red-600">*</span></label>
            <input
              type="text" value={form.locationName} onChange={update('locationName')}
              placeholder="Tema branch, main warehouse…" className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Address</label>
            <input
              type="text" value={form.address} onChange={update('address')}
              placeholder="Street or landmark" className="form-input"
            />
          </div>
        </div>

        <div>
          <label className="form-label">Purpose of the visit</label>
          <input
            type="text" value={form.purpose} onChange={update('purpose')}
            placeholder="Walk the site ahead of the rollout quote" className="form-input"
          />
          <p className="text-xs text-slate-500 mt-1">
            Doubles as the timeline summary if you leave that blank.
          </p>
        </div>

        {/* Everything below is only knowable after the trip: who actually
            went, who they met, and what they found. Planning stops at why. */}
        {!planning && (
          <>
            <div>
              <label className="form-label">Photos</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                className="text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? '' : 's'} will upload once the visit is saved.`
                  : 'Site conditions are much easier to show than describe.'}
              </p>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Who went (our side)</label>
            <input
              type="text" value={form.teamAttendees} onChange={update('teamAttendees')}
              placeholder="Comma separated" className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Who we met (their side)</label>
            <input
              type="text" value={form.clientAttendees} onChange={update('clientAttendees')}
              placeholder="Comma separated" className="form-input"
            />
          </div>
        </div>

            <div>
              <label className="form-label">What did you find?</label>
              <textarea
                value={form.observations} onChange={update('observations')} rows={4}
                placeholder="Site conditions, what they said, what needs to happen next…"
                className="form-input"
              />
              <p className="text-xs text-slate-500 mt-1">
                A visit with no write-up gets chased — the point of the trip is the knowledge.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">How did it go?</label>
                <div className="flex gap-1.5">
                  {SENTIMENTS.map((s) => (
                    <button
                      key={s} type="button"
                      onClick={() => setForm((f) => ({ ...f, sentiment: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        form.sentiment === s
                          ? 'bg-navy-700 text-white border-navy-700'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                      }`}
                    >
                      {SENTIMENT_ICON[s]} {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Time on site (minutes)</label>
                <input
                  type="number" min="0" value={form.durationMinutes}
                  onChange={update('durationMinutes')} placeholder="90" className="form-input"
                />
              </div>
            </div>
          </>
        )}

        {/* Promising something on site is part of the same action. */}
        {!existing && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
            <p className="text-xs font-semibold text-navy-900">Did you promise them anything?</p>
            <input
              type="text" value={form.commitmentDescription}
              onChange={update('commitmentDescription')}
              placeholder="Send the site survey report" className="form-input"
            />
            {form.commitmentDescription.trim() && (
              <div>
                <label className="form-label">By when</label>
                <input type="date" value={form.commitmentDue} onChange={update('commitmentDue')} className="form-input" />
                <p className="text-xs text-slate-500 mt-1">
                  Tracked as a commitment on the client record, and chased if it slips.
                </p>
              </div>
            )}
          </div>
        )}

        {existing && (
          <div>
            <label className="form-label">Status</label>
            <select value={form.visitStatus} onChange={update('visitStatus')} className="form-input">
              {['Planned', 'Completed', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default VisitFormModal;
