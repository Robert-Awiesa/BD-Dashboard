import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';

const blankContact = { name: '', role: '', email: '', phone: '', isPrimary: false };

const emptyForm = {
  name: '',
  logoUrl: '',
  partnerType: 'Strategic Partner',
  offering: '',
  website: '',
  location: '',
  relationshipOwner: '',
  partnerSince: '',
  contacts: [{ ...blankContact, isPrimary: true }],
  notes: '',
};

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

// The directory is only worth having if the entry can be acted on, so the form
// pushes for what someone reaching out actually needs: what they give us, and
// a person with an email or a phone number.
const PartnerFormModal = ({ open, onClose, onSaved, existing = null, currentUser }) => {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(() =>
    existing
      ? {
          ...emptyForm,
          ...existing,
          partnerSince: toDateInput(existing.partnerSince),
          contacts: existing.contacts?.length
            ? existing.contacts.map((c) => ({ ...blankContact, ...c }))
            : [{ ...blankContact, isPrimary: true }],
        }
      : { ...emptyForm, relationshipOwner: currentUser || '' }
  );
  const [owners, setOwners] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    bdApi.getPartnerOwners()
      .then((rows) => { if (!ignore) setOwners(rows); })
      .catch(() => { /* the field still accepts a typed name */ });
    return () => { ignore = true; };
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const setContact = (index, field, value) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  // Exactly one primary, so the card always has somebody to show.
  const makePrimary = (index) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => ({ ...c, isPrimary: i === index })),
    }));

  const addContact = () =>
    setForm((f) => ({ ...f, contacts: [...f.contacts, { ...blankContact }] }));

  const removeContact = (index) =>
    setForm((f) => {
      const contacts = f.contacts.filter((_, i) => i !== index);
      if (contacts.length && !contacts.some((c) => c.isPrimary)) contacts[0].isPrimary = true;
      return { ...f, contacts: contacts.length ? contacts : [{ ...blankContact, isPrimary: true }] };
    });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Give the partner a name.');
    if (!form.offering.trim()) {
      return setError('Say what they offer us — that is what somebody searching will read.');
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        contacts: form.contacts.filter((c) => c.name.trim()),
      };
      onSaved(isEdit
        ? await bdApi.updatePartner(existing._id, payload)
        : await bdApi.addPartner(payload));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="partner-form" disabled={busy}>
        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add partner'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${existing.name}` : 'Add a partner'}
      description="Who they are, what they give us, and somebody who can be reached."
      footer={footer}
    >
      <form id="partner-form" className="space-y-4" onSubmit={submit}>
        {error && (
          <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="form-label">Organisation *</label>
            <input type="text" value={form.name} onChange={set('name')}
              className="form-input" placeholder="e.g. OpenText" />
          </div>
          <div className="sm:col-span-1">
            <label className="form-label">Partner Category</label>
            <select value={form.partnerType} onChange={set('partnerType')} className="form-input">
              <option value="Strategic Partner">Strategic Partner</option>
              <option value="Technology / OEM">Technology / OEM</option>
              <option value="Reseller / Distributor">Reseller / Distributor</option>
              <option value="Implementation Partner">Implementation Partner</option>
              <option value="Consulting / Advisory">Consulting / Advisory</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="form-label">Who here knows them</label>
            <input type="text" list="partner-owners" value={form.relationshipOwner}
              onChange={set('relationshipOwner')} className="form-input"
              placeholder="Somebody to ask" />
          </div>
        </div>

        <div>
          <label className="form-label">Partner Logo URL (Optional)</label>
          <input type="url" value={form.logoUrl} onChange={set('logoUrl')}
            className="form-input" placeholder="https://domain.com/logo.png" />
        </div>

        <div>
          <label className="form-label">What they offer us *</label>
          <textarea value={form.offering} onChange={set('offering')} rows={2}
            className="form-input"
            placeholder="e.g. Content Suite and Extended ECM — we implement and resell" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Website</label>
            <input type="url" value={form.website} onChange={set('website')}
              className="form-input" placeholder="https://…" />
          </div>
          <div>
            <label className="form-label">Where they are</label>
            <input type="text" value={form.location} onChange={set('location')}
              className="form-input" placeholder="Accra" />
          </div>
          <div>
            <label className="form-label">Partner since</label>
            <input type="date" value={form.partnerSince} onChange={set('partnerSince')}
              className="form-input" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label !mb-0">Who to contact</label>
            <button type="button" onClick={addContact}
              className="text-xs font-medium text-navy-700 hover:underline cursor-pointer">
              + Add person
            </button>
          </div>

          <div className="space-y-2">
            {form.contacts.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" value={c.name} onChange={(e) => setContact(i, 'name', e.target.value)}
                    className="form-input" placeholder="Name" />
                  <input type="text" value={c.role} onChange={(e) => setContact(i, 'role', e.target.value)}
                    className="form-input" placeholder="Role" />
                  <input type="email" value={c.email} onChange={(e) => setContact(i, 'email', e.target.value)}
                    className="form-input" placeholder="Email" />
                  <input type="tel" value={c.phone} onChange={(e) => setContact(i, 'phone', e.target.value)}
                    className="form-input" placeholder="Phone" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="radio" name="primary-contact" checked={Boolean(c.isPrimary)}
                      onChange={() => makePrimary(i)} className="accent-navy-700 cursor-pointer" />
                    Try this one first
                  </label>
                  {form.contacts.length > 1 && (
                    <button type="button" onClick={() => removeContact(i)}
                      className="text-xs text-red-600 hover:underline cursor-pointer">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2}
            className="form-input" placeholder="Anything worth knowing before reaching out" />
        </div>

        <datalist id="partner-owners">
          {owners.map((o) => <option key={o} value={o} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default PartnerFormModal;
