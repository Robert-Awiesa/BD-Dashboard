import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PartnerFormModal from './PartnerFormModal';

// A directory, not a pipeline. It answers three questions and nothing else:
// who do we partner with, what does each one give us, and who do I ring.
//
// It replaces a placeholder that listed three invented companies and had a
// "+ Register Partner" button with no click handler behind it.

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

// Contact details are the point, so they are links you can act on rather than
// text to copy out by hand.
const ContactLines = ({ contact }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
    {contact.email && (
      <a href={`mailto:${contact.email}`} className="text-navy-700 hover:underline break-all">
        {contact.email}
      </a>
    )}
    {contact.phone && (
      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-navy-700 hover:underline">
        {contact.phone}
      </a>
    )}
    {!contact.email && !contact.phone && (
      <span className="text-amber-700">no email or phone on file</span>
    )}
  </div>
);

const PartnersModule = () => {
  const { currentUser } = useDashboard();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    bdApi.getPartners({ search: debounced, includeArchived: includeArchived ? 'true' : '' })
      .then((rows) => { if (!ignore) { setPartners(rows); setError(null); } })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debounced, includeArchived, refreshToken]);

  const refresh = () => setRefreshToken((t) => t + 1);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (partner) => { setEditing(partner); setViewing(null); setFormOpen(true); };

  const toggleArchive = async (partner) => {
    try {
      await bdApi.setPartnerArchived(partner._id, !partner.archived);
      setViewing(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (partner) => {
    if (!window.confirm(`Delete ${partner.name}? Their contact details go too.`)) return;
    try {
      await bdApi.deletePartner(partner._id);
      setViewing(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const unreachable = partners.filter((p) => !p.isReachable && !p.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Partners</h1>
          <p className="text-sm text-slate-600">
            Who we work with, what each one gives us, and how to reach them.
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>+ Add partner</Button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Grid cells do the sizing — `.form-input` forces width:100%, so a width
          utility on the control itself would lose. */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a partner, what they offer, or a contact's name…"
            className="form-input"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap px-1">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-navy-700 cursor-pointer"
            />
            Show archived
          </label>
        </div>
      </div>

      {unreachable.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {unreachable.length} partner{unreachable.length === 1 ? ' has' : 's have'} no email or
          phone on file — {unreachable.map((p) => p.name).join(', ')}. A directory entry nobody can
          act on is just a name.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-300 rounded-xl bg-white">
          <p className="text-sm text-slate-600">
            {debounced ? 'No partner matches that.' : 'No partners yet.'}
          </p>
          {!debounced && (
            <Button variant="secondary" className="mt-3" onClick={openNew}>
              Add the first one
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {partners.map((partner) => (
            <button
              key={partner._id}
              type="button"
              onClick={() => setViewing(partner)}
              className={`text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 ${
                partner.archived ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-navy-900">{partner.name}</span>
                {partner.archived && (
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Archived</span>
                )}
              </div>

              <p className="text-xs text-slate-600 line-clamp-3">{partner.offering}</p>

              {partner.primaryContact && (
                <div className="mt-auto pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-navy-900">
                    {partner.primaryContact.name}
                    {partner.primaryContact.role ? ` · ${partner.primaryContact.role}` : ''}
                  </p>
                  <ContactLines contact={partner.primaryContact} />
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                {[
                  partner.location,
                  partner.partnerSince ? `since ${formatDate(partner.partnerSince)}` : '',
                  partner.relationshipOwner ? `ask ${partner.relationshipOwner}` : '',
                ].filter(Boolean).join(' · ')}
              </p>
            </button>
          ))}
        </div>
      )}

      <PartnerFormModal
        key={editing?._id || 'new-partner'}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={refresh}
        existing={editing}
        currentUser={currentUser}
      />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        description={viewing?.location || ''}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {viewing?.archived && (
              <Button variant="danger" onClick={() => remove(viewing)}>Delete</Button>
            )}
            <Button variant="secondary" onClick={() => toggleArchive(viewing)}>
              {viewing?.archived ? '↩ Restore' : '🗄 Archive'}
            </Button>
            <Button variant="primary" onClick={() => openEdit(viewing)}>✎ Edit</Button>
          </div>
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                What they offer us
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap mt-0.5">{viewing.offering}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Who to contact
              </p>
              {viewing.contacts?.length ? (
                <ul className="space-y-1.5">
                  {viewing.contacts.map((c) => (
                    <li key={c._id || c.name} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-navy-900">{c.name}</span>
                        {c.isPrimary && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-50 text-navy-700 font-semibold">
                            TRY FIRST
                          </span>
                        )}
                        {c.role && <span className="text-xs text-slate-500">{c.role}</span>}
                      </div>
                      <ContactLines contact={c} />
                      {c.notes && <p className="text-xs text-slate-500 mt-0.5">{c.notes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700">
                  Nobody on file — this entry cannot be acted on yet.
                </p>
              )}
            </div>

            <dl className="text-sm">
              {viewing.website && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Website</dt>
                  <dd>
                    <a href={viewing.website} target="_blank" rel="noopener noreferrer"
                      className="text-navy-700 hover:underline break-all">
                      {viewing.website}
                    </a>
                  </dd>
                </div>
              )}
              {viewing.partnerSince && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Partner since</dt>
                  <dd className="text-navy-900">{formatDate(viewing.partnerSince)}</dd>
                </div>
              )}
              {viewing.relationshipOwner && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Ask here</dt>
                  <dd className="text-navy-900">{viewing.relationshipOwner}</dd>
                </div>
              )}
            </dl>

            {viewing.notes && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewing.notes}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PartnersModule;
