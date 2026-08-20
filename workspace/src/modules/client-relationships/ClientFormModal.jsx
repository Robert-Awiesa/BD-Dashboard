import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import {
  CLIENT_STATUSES,
  DEFAULT_CADENCE_DAYS,
  TIERS,
  emptyClientForm,
  toDateInput,
} from './clientConstants';

const ClientFormModal = ({ open, onClose, onSaved, currentUser, existing = null, owners = [], sectors = [] }) => {
  const isEditing = Boolean(existing);

  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyClientForm,
        ...existing,
        contactCadenceDays: existing.contactCadenceDays || '',
        contractValue: existing.contractValue || '',
        relationshipStart: toDateInput(existing.relationshipStart),
        renewalDate: toDateInput(existing.renewalDate),
        tags: existing.tags || [],
        contacts: existing.contacts || [],
      };
    }
    return { ...emptyClientForm, accountOwner: currentUser || '' };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const updateContact = (index, field, value) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  const addContact = () =>
    setForm((f) => ({
      ...f,
      // First contact added is the primary one by default.
      contacts: [...f.contacts, { name: '', role: '', email: '', phone: '', isPrimary: f.contacts.length === 0 }],
    }));

  const removeContact = (index) =>
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== index) }));

  // Exactly one primary — picking a new one demotes the old.
  const makePrimary = (index) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => ({ ...c, isPrimary: i === index })),
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('A client name is required.');

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        contractValue: Number(form.contractValue) || 0,
        contactCadenceDays: form.contactCadenceDays ? Number(form.contactCadenceDays) : '',
        contacts: form.contacts.filter((c) => c.name.trim()),
      };
      const saved = isEditing
        ? await bdApi.updateClient(existing._id, payload)
        : await bdApi.addClient(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="client-form" disabled={submitting}>
        {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add client'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEditing ? `Edit — ${existing.name}` : 'Add a client'}
      description="The relationship record: who they are, who owns them, and how often we should be in touch."
      footer={footer}
    >
      <form id="client-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Client name <span className="text-red-600">*</span></label>
            <input type="text" value={form.name} onChange={update('name')} className="form-input" placeholder="St Andrew Hospital" />
          </div>
          <div>
            <label className="form-label">Sector</label>
            <input type="text" list="client-sectors" value={form.sector} onChange={update('sector')} className="form-input" placeholder="Healthcare" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Account owner</label>
            <input type="text" list="client-owners" value={form.accountOwner} onChange={update('accountOwner')} className="form-input" placeholder="Who looks after them" />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={update('status')} className="form-input">
              {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Tier drives the contact rhythm, which is what makes the attention
            queue meaningful — so the consequence is shown inline. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Tier</label>
            <select value={form.tier} onChange={update('tier')} className="form-input">
              {TIERS.map((t) => <option key={t} value={t}>{t} — every {DEFAULT_CADENCE_DAYS[t]} days</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Contact cadence override</label>
            <input
              type="number" min="1" value={form.contactCadenceDays}
              onChange={update('contactCadenceDays')} className="form-input"
              placeholder={String(DEFAULT_CADENCE_DAYS[form.tier])}
            />
            <p className="text-xs text-slate-500 mt-1">
              Blank uses the {form.tier} default of {DEFAULT_CADENCE_DAYS[form.tier]} days. Past this
              without contact, the account is flagged as gone quiet.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Relationship start</label>
            <input type="date" value={form.relationshipStart} onChange={update('relationshipStart')} className="form-input" />
          </div>
          <div>
            <label className="form-label">Contract value</label>
            <input type="number" min="0" value={form.contractValue} onChange={update('contractValue')} className="form-input" placeholder="0" />
          </div>
          <div>
            <label className="form-label">Renewal date</label>
            <input type="date" value={form.renewalDate} onChange={update('renewalDate')} className="form-input" />
          </div>
        </div>

        {/* --- Contacts --- */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-navy-900">Contacts</p>
              <p className="text-xs text-slate-500">Who we actually talk to.</p>
            </div>
            <Button variant="secondary" onClick={addContact}>+ Add contact</Button>
          </div>

          {form.contacts.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No contacts yet.</p>
          ) : (
            <div className="space-y-2">
              {form.contacts.map((contact, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text" value={contact.name}
                      onChange={(e) => updateContact(index, 'name', e.target.value)}
                      placeholder="Name" className="form-input"
                    />
                    <input
                      type="text" value={contact.role}
                      onChange={(e) => updateContact(index, 'role', e.target.value)}
                      placeholder="Role" className="form-input"
                    />
                    <input
                      type="email" value={contact.email}
                      onChange={(e) => updateContact(index, 'email', e.target.value)}
                      placeholder="Email" className="form-input"
                    />
                    <input
                      type="text" value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="Phone" className="form-input"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="radio" name="primary-contact" checked={Boolean(contact.isPrimary)}
                        onChange={() => makePrimary(index)} className="accent-navy-700 cursor-pointer"
                      />
                      Primary contact
                    </label>
                    <button
                      type="button" onClick={() => removeContact(index)}
                      className="text-xs text-slate-500 hover:text-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 space-y-4">
          <div>
            <label className="form-label">Tags</label>
            <TagInput
              value={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="Enterprise, Multi-site, Referral…"
            />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={update('notes')} rows={3} className="form-input" />
          </div>
        </div>

        <datalist id="client-owners">
          {owners.map((o) => <option key={o} value={o} />)}
        </datalist>
        <datalist id="client-sectors">
          {sectors.map((s) => <option key={s} value={s} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default ClientFormModal;
