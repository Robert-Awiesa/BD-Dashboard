import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/useDashboard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PartnerFormModal from './PartnerFormModal';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const getInitials = (name) => {
  if (!name) return 'P';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getWebsiteHost = (url) => {
  if (!url) return '';
  try {
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    const host = new URL(formatted).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
};

const ContactLines = ({ contact }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    {contact.email && (
      <a
        href={`mailto:${contact.email}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-navy-800 hover:bg-navy-50 hover:text-navy-900 font-medium transition-colors break-all"
      >
        <span>✉️</span> {contact.email}
      </a>
    )}
    {contact.phone && (
      <a
        href={`tel:${contact.phone.replace(/\s+/g, '')}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-navy-800 hover:bg-navy-50 hover:text-navy-900 font-medium transition-colors"
      >
        <span>📞</span> {contact.phone}
      </a>
    )}
    {!contact.email && !contact.phone && (
      <span className="text-amber-700 text-[11px] italic">no contact phone/email on file</span>
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
          <h1 className="text-2xl font-bold text-navy-900">Partners & Alliances</h1>
          <p className="text-sm text-slate-600">
            Institutional directory of solution partners, technology OEMs, and strategic relationship owners.
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>+ Add partner</Button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a partner, offering, website, or contact name…"
            className="form-input"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap px-1">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-navy-700 cursor-pointer"
            />
            Show archived partners
          </label>
        </div>
      </div>

      {unreachable.length > 0 && (
        <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>{unreachable.length} partner{unreachable.length === 1 ? ' has' : 's have'} incomplete contact details:</strong>{' '}
            {unreachable.map((p) => p.name).join(', ')}. Update primary contact emails & phones to maintain directory reachability.
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="h-56 skeleton rounded-2xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-slate-300 rounded-2xl bg-white space-y-2">
          <span className="text-3xl">🤝</span>
          <p className="text-base font-bold text-navy-950">
            {debounced ? 'No partners match your search.' : 'No partner profiles created yet.'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Build your institutional directory of technology vendors, reseller agreements, and solution alliances.
          </p>
          {!debounced && (
            <div className="pt-2">
              <Button variant="primary" onClick={openNew}>
                + Add First Partner Profile
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Restructured Modern Partner Profile Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {partners.map((partner) => (
            <div
              key={partner._id}
              onClick={() => setViewing(partner)}
              className={`group relative flex flex-col justify-between bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-navy-400 transition-all cursor-pointer overflow-hidden ${
                partner.archived ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-slate-200'
              }`}
            >
              {/* Decorative Header Accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-navy-800 via-emerald-600 to-amber-500" />

              <div>
                {/* Header: Logo / Avatar Badge + Name + Website + Category Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {partner.logoUrl ? (
                      <img
                        src={partner.logoUrl}
                        alt={partner.name}
                        className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-200/80 p-1 shrink-0 shadow-2xs"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-800 text-white font-bold text-base flex items-center justify-center shadow-2xs shrink-0 tracking-wider">
                        {getInitials(partner.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-navy-950 group-hover:text-navy-700 transition-colors truncate">
                        {partner.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        {partner.location && (
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <span>📍</span> {partner.location}
                          </span>
                        )}
                        {partner.website && (
                          <a
                            href={partner.website.startsWith('http') ? partner.website : `https://${partner.website}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-navy-700 hover:text-navy-900 hover:underline font-medium"
                          >
                            <span>🌐</span> {getWebsiteHost(partner.website)}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {partner.archived ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        Archived
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-navy-50 text-navy-800 border border-navy-100">
                        {partner.partnerType || 'Strategic Partner'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Offering Box ("WHAT THEY OFFER US") */}
                <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 my-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>💼</span> Capabilities & Offering
                  </span>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed line-clamp-3">
                    “{partner.offering}”
                  </p>
                </div>
              </div>

              {/* Primary Contact Profile Footer */}
              <div>
                {partner.primaryContact && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-navy-950 flex items-center gap-1.5 truncate">
                        <span>👤</span> {partner.primaryContact.name}
                        {partner.primaryContact.role && (
                          <span className="text-slate-500 font-normal">({partner.primaryContact.role})</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Primary Contact</span>
                    </div>

                    <ContactLines contact={partner.primaryContact} />
                  </div>
                )}

                {/* Footer Metadata: Partner since & Internal Lead */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>
                    {partner.partnerSince ? `Partnered ${formatDate(partner.partnerSince)}` : 'Active Directory Record'}
                  </span>
                  {partner.relationshipOwner && (
                    <span className="font-medium text-slate-700">
                      Lead: <span className="text-navy-900 font-semibold">{partner.relationshipOwner}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
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

      {/* Detail View Modal */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        description={viewing?.location ? `📍 ${viewing.location}` : 'Partner Profile Details'}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {viewing?.archived && (
              <Button variant="danger" onClick={() => remove(viewing)}>Delete</Button>
            )}
            <Button variant="secondary" onClick={() => toggleArchive(viewing)}>
              {viewing?.archived ? '↩ Restore' : '🗄 Archive'}
            </Button>
            <Button variant="primary" onClick={() => openEdit(viewing)}>✎ Edit Profile</Button>
          </div>
        }
      >
        {viewing && (
          <div className="space-y-5 text-xs">
            {/* Header Header Info with Logo */}
            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {viewing.logoUrl ? (
                <img
                  src={viewing.logoUrl}
                  alt={viewing.name}
                  className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-navy-900 text-white font-bold text-lg flex items-center justify-center shrink-0">
                  {getInitials(viewing.name)}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-navy-950">{viewing.name}</h3>
                <p className="text-slate-500 font-medium">{viewing.partnerType || 'Strategic Partner'}</p>
                {viewing.website && (
                  <a
                    href={viewing.website.startsWith('http') ? viewing.website : `https://${viewing.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-navy-700 hover:underline text-xs"
                  >
                    🌐 {viewing.website}
                  </a>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                💼 What They Offer Us
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200 leading-relaxed font-medium">
                {viewing.offering}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                👥 Contact Directory ({viewing.contacts?.length || 0})
              </p>
              {viewing.contacts?.length ? (
                <ul className="space-y-2">
                  {viewing.contacts.map((c) => (
                    <li key={c._id || c.name} className="rounded-xl border border-slate-200 px-3.5 py-2.5 bg-white space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-navy-950">{c.name}</span>
                          {c.role && <span className="text-xs text-slate-500">· {c.role}</span>}
                        </div>
                        {c.isPrimary && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold tracking-wider uppercase">
                            PRIMARY CONTACT
                          </span>
                        )}
                      </div>
                      <ContactLines contact={c} />
                      {c.notes && <p className="text-xs text-slate-500 mt-1 italic">“{c.notes}”</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Nobody on file — add contact details to make this directory entry actionable.
                </p>
              )}
            </div>

            <dl className="text-xs space-y-1.5 pt-2 border-t border-slate-200">
              {viewing.partnerSince && (
                <div className="flex justify-between gap-4 py-1 border-b border-slate-100">
                  <dt className="text-slate-500">Partner Since</dt>
                  <dd className="font-semibold text-navy-950">{formatDate(viewing.partnerSince)}</dd>
                </div>
              )}
              {viewing.relationshipOwner && (
                <div className="flex justify-between gap-4 py-1 border-b border-slate-100">
                  <dt className="text-slate-500">Internal Relationship Owner</dt>
                  <dd className="font-semibold text-navy-950">{viewing.relationshipOwner}</dd>
                </div>
              )}
            </dl>

            {viewing.notes && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  📝 Internal Notes
                </p>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
                  {viewing.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PartnersModule;
