import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import {
  EVENT_TYPES, MEDIA_EVENT_TYPES, MODALITIES, ATTENDEE_ROLES,
  RSVP_STATUSES, emptyEventForm,
} from './eventConstants';

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EventWizardModal = ({ open, onClose, onSubmit, submitting, initialData, scripts = [], campaigns = [] }) => {
  const buildInitial = () => {
    if (!initialData) return emptyEventForm;
    return {
      ...emptyEventForm,
      ...initialData,
      startDate: toDateTimeLocal(initialData.startDate),
      endDate: toDateTimeLocal(initialData.endDate),
      linkedScript: initialData.linkedScript?._id || initialData.linkedScript || '',
      linkedCampaign: initialData.linkedCampaign?._id || initialData.linkedCampaign || '',
      speakers: initialData.speakers || [],
      prepChecklist: initialData.prepChecklist || [],
      attendees: initialData.attendees || [],
    };
  };

  const [form, setForm] = useState(buildInitial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);

  const isMedia = MEDIA_EVENT_TYPES.includes(form.eventType);

  // The media stage only exists for webinars/podcasts — a physical summit
  // shouldn't be asked for an episode number.
  const steps = isMedia
    ? ['Details', 'Media Production', 'Prep & Attendance']
    : ['Details', 'Prep & Attendance'];
  const currentLabel = steps[step];

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const onInput = (field) => (e) => set(field, e.target.value);

  const handleClose = () => {
    setForm(emptyEventForm);
    setStep(0);
    setError(null);
    onClose();
  };

  const addRow = (field, row) => setForm((f) => ({ ...f, [field]: [...(f[field] || []), row] }));
  const updateRow = (field, idx, key, val) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    }));
  const removeRow = (field, idx) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  const validate = () => {
    if (currentLabel === 'Details') {
      if (!form.title.trim()) return 'Event title is required.';
      if (!form.startDate) return 'Start date & time is required.';
      if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
        return 'End date cannot be before the start date.';
      }
      if (form.modality !== 'Online' && !form.locationDetails.trim()) {
        return 'Venue details are required for physical or hybrid events.';
      }
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const err = validate();
    if (err) return setError(err);
    try {
      await onSubmit({
        ...form,
        linkedScript: form.linkedScript || null,
        linkedCampaign: form.linkedCampaign || null,
        endDate: form.endDate || null,
      });
      handleClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const footer = (
    <div className="flex justify-between items-center gap-3">
      <Button type="button" variant="secondary" onClick={step === 0 ? handleClose : back}>
        {step === 0 ? 'Cancel' : '← Back'}
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Step {step + 1} of {steps.length}</span>
        {step < steps.length - 1 ? (
          <Button type="button" variant="primary" onClick={next}>Next →</Button>
        ) : (
          <Button type="button" variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Update Event' : 'Create Event'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialData ? 'Edit Event' : 'New Event / Forum / Media'}
      description={currentLabel}
      size="lg"
      footer={footer}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {steps.map((label, idx) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                idx === step ? 'bg-navy-700 text-white' : idx < step ? 'bg-forest-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {idx < step ? '✓' : idx + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${idx === step ? 'text-navy-800 font-medium' : 'text-slate-500'}`}>{label}</span>
              {idx < steps.length - 1 && <div className="flex-1 h-px bg-slate-200 min-w-4" />}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {currentLabel === 'Details' && (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Event Title *</label>
                <input type="text" value={form.title} onChange={onInput('title')} className="w-full form-input" placeholder="e.g. The Future of AI in African Enterprise" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select value={form.eventType} onChange={onInput('eventType')} className="w-full form-input">
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Accountable Lead</label>
                  <input type="text" value={form.assignedLead} onChange={onInput('assignedLead')} className="w-full form-input" placeholder="e.g. Thabo M." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Start Date & Time *</label>
                  <input type="datetime-local" value={form.startDate} onChange={onInput('startDate')} className="w-full form-input" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">End Date & Time</label>
                  <input type="datetime-local" value={form.endDate} onChange={onInput('endDate')} className="w-full form-input" />
                  <p className="text-[11px] text-slate-400 mt-1">Leave blank for a single-day event.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Modality</label>
                  <select value={form.modality} onChange={onInput('modality')} className="w-full form-input">
                    {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    {form.modality === 'Online' ? 'Streaming / Meeting Link' : 'Venue / Location'}
                    {form.modality !== 'Online' ? ' *' : ''}
                  </label>
                  <input type="text" value={form.locationDetails} onChange={onInput('locationDetails')} className="w-full form-input"
                    placeholder={form.modality === 'Online' ? 'Zoom / YouTube Live / StreamYard URL' : 'e.g. Accra International Conference Centre'} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Description / Objectives</label>
                <textarea value={form.description} onChange={onInput('description')} rows={2} className="w-full form-input resize-y" placeholder="What is this event setting out to achieve?" />
              </div>
            </>
          )}

          {currentLabel === 'Media Production' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Episode / Session Number</label>
                  <input type="text" value={form.episodeNumber} onChange={onInput('episodeNumber')} className="w-full form-input" placeholder="e.g. Season 2, Episode 4" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Host / Moderator</label>
                  <input type="text" value={form.hostModerator} onChange={onInput('hostModerator')} className="w-full form-input" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Linked Script</label>
                  <select value={form.linkedScript} onChange={onInput('linkedScript')} className="w-full form-input">
                    <option value="">— none —</option>
                    {scripts.map((s) => (
                      <option key={s._id} value={s._id}>{s.title}{s.product ? ` · ${s.product}` : ''}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Pulled from your Scripts Repository.</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Linked Promo Campaign</label>
                  <select value={form.linkedCampaign} onChange={onInput('linkedCampaign')} className="w-full form-input">
                    <option value="">— none —</option>
                    {campaigns.map((c) => (
                      <option key={c._id} value={c._id}>{c.campaignName}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Syncs promotional scheduling.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-600">Guest Speakers / Panelists</label>
                  <button type="button" onClick={() => addRow('speakers', { name: '', title: '', organization: '', linkedin: '' })} className="text-xs text-navy-700 hover:underline cursor-pointer">+ Add speaker</button>
                </div>
                <div className="space-y-2">
                  {form.speakers.length === 0 && <p className="text-xs text-slate-400">No speakers added yet.</p>}
                  {form.speakers.map((sp, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={sp.name} onChange={(e) => updateRow('speakers', i, 'name', e.target.value)} className="form-input" placeholder="Name" />
                      <input type="text" value={sp.title} onChange={(e) => updateRow('speakers', i, 'title', e.target.value)} className="form-input" placeholder="Title" />
                      <input type="text" value={sp.organization} onChange={(e) => updateRow('speakers', i, 'organization', e.target.value)} className="form-input" placeholder="Organization" />
                      <input type="text" value={sp.linkedin} onChange={(e) => updateRow('speakers', i, 'linkedin', e.target.value)} className="form-input" placeholder="LinkedIn" />
                      <button type="button" onClick={() => removeRow('speakers', i)} className="text-red-600 hover:text-red-700 text-sm px-2 cursor-pointer" aria-label="Remove speaker">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentLabel === 'Prep & Attendance' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-600">Pre-Event Checklist</label>
                  <button type="button" onClick={() => addRow('prepChecklist', { taskName: '', assignedTo: '', dueDate: '', completed: false })} className="text-xs text-navy-700 hover:underline cursor-pointer">+ Add task</button>
                </div>
                <div className="space-y-2">
                  {form.prepChecklist.length === 0 && <p className="text-xs text-slate-400">e.g. book venue, test mic &amp; camera, design promo graphic, send 24h reminders.</p>}
                  {form.prepChecklist.map((t, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={t.taskName} onChange={(e) => updateRow('prepChecklist', i, 'taskName', e.target.value)} className="form-input" placeholder="Task" />
                      <input type="text" value={t.assignedTo} onChange={(e) => updateRow('prepChecklist', i, 'assignedTo', e.target.value)} className="form-input" placeholder="Owner" />
                      <input type="date" value={t.dueDate ? String(t.dueDate).slice(0, 10) : ''} onChange={(e) => updateRow('prepChecklist', i, 'dueDate', e.target.value)} className="form-input" />
                      <button type="button" onClick={() => removeRow('prepChecklist', i)} className="text-red-600 hover:text-red-700 text-sm px-2 cursor-pointer" aria-label="Remove task">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-600">Internal Attendance / RSVP</label>
                  <button type="button" onClick={() => addRow('attendees', { memberName: '', role: 'Attendee', status: 'Pending' })} className="text-xs text-navy-700 hover:underline cursor-pointer">+ Add member</button>
                </div>
                <div className="space-y-2">
                  {form.attendees.length === 0 && <p className="text-xs text-slate-400">Track who attends, speaks, or runs the booth.</p>}
                  {form.attendees.map((a, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={a.memberName} onChange={(e) => updateRow('attendees', i, 'memberName', e.target.value)} className="form-input" placeholder="Team member" />
                      <select value={a.role} onChange={(e) => updateRow('attendees', i, 'role', e.target.value)} className="form-input">
                        {ATTENDEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select value={a.status} onChange={(e) => updateRow('attendees', i, 'status', e.target.value)} className="form-input">
                        {RSVP_STATUSES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="button" onClick={() => removeRow('attendees', i)} className="text-red-600 hover:text-red-700 text-sm px-2 cursor-pointer" aria-label="Remove attendee">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      </div>
    </Modal>
  );
};

export default EventWizardModal;
