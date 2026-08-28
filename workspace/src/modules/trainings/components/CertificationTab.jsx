import { useState } from 'react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const ECOSYSTEM_THEMES = {
  AWS: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '☁️',
    label: 'AWS',
  },
  SAP: {
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: '🏢',
    label: 'SAP',
  },
  Esri: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: '🗺️',
    label: 'Esri',
  },
  OpenText: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    icon: '📁',
    label: 'OpenText',
  },
  Other: {
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: '✨',
    label: 'Other Ecosystem',
  },
};

const STATUS_BADGES = {
  Planned: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const CertificationTab = ({ certs, loading, onEdit, onDelete, onArchive, onOpenCreate, onQuickStatus }) => {
  const [activeVendor, setActiveVendor] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tenderOnly, setTenderOnly] = useState(false);
  const [search, setSearch] = useState('');

  const VENDORS = ['All', 'AWS', 'SAP', 'Esri', 'OpenText', 'Other'];

  const getExpiryDetails = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiry = new Date(expiryDate);
    const expiryOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const days = Math.round((expiryOnly - today) / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return {
        status: 'expired',
        days: Math.abs(days),
        text: `🚨 Expired ${Math.abs(days)}d ago (${formatDate(expiryDate)})`,
        badgeClass: 'bg-red-50 text-red-700 border-red-200 font-bold',
      };
    }
    if (days <= 90) {
      return {
        status: 'warning',
        days,
        text: `⚠️ Renewal due in ${days} days (${formatDate(expiryDate)})`,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
      };
    }
    return {
      status: 'valid',
      days,
      text: `Valid until ${formatDate(expiryDate)}`,
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    };
  };

  const filteredCerts = certs.filter((c) => {
    if (activeVendor !== 'All' && c.ecosystem !== activeVendor) return false;
    if (tenderOnly && !c.tenderPartnerImpact) return false;

    if (statusFilter === 'ExpiringSoon') {
      const exp = getExpiryDetails(c.expiryDate);
      if (!exp || (exp.status !== 'warning' && exp.status !== 'expired')) return false;
    } else if (statusFilter !== 'All' && c.progress !== statusFilter) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchCandidate = c.candidate?.toLowerCase().includes(q);
      const matchCred = (c.credentialIdUrl || '').toLowerCase().includes(q);
      const matchCustom = (c.customEcosystem || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCandidate && !matchCred && !matchCustom) return false;
    }
    return true;
  });

  const getCountForVendor = (v) => {
    if (v === 'All') return certs.length;
    return certs.filter((c) => c.ecosystem === v).length;
  };

  const expiringCount = certs.filter((c) => {
    const exp = getExpiryDetails(c.expiryDate);
    return exp && (exp.status === 'warning' || exp.status === 'expired');
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Vendor Badges & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          {VENDORS.map((v) => {
            const isSelected = activeVendor === v;
            const count = getCountForVendor(v);
            return (
              <button
                key={v}
                onClick={() => setActiveVendor(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-navy-900 shadow-xs border border-slate-200/60 font-bold'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                <span>{v === 'All' ? '🌐 All' : ECOSYSTEM_THEMES[v]?.icon}</span>
                <span>{v}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-navy-100 text-navy-900 font-bold' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <Button variant="primary" onClick={onOpenCreate}>
          <span>+</span> Add Certification
        </Button>
      </div>

      {/* Expiry Warning Banner (if any credentials are due for renewal) */}
      {expiringCount > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Recertification Warning: {expiringCount} Credential{expiringCount > 1 ? 's' : ''} Need Attention
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Staff credentials are due for expiration or have lapsed. Keep certifications active to maintain partner tiers and tender eligibility.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === 'ExpiringSoon' ? 'All' : 'ExpiringSoon')}
            className="text-xs font-bold px-3 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-950 rounded-xl transition-colors shrink-0"
          >
            {statusFilter === 'ExpiringSoon' ? 'Show All Certs' : 'View Expiring Only'}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="text-slate-400 text-sm pl-1">🔍</span>
          <input
            type="text"
            placeholder="Search credentials by title, candidate name, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs text-navy-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tender Impact filter */}
          <button
            onClick={() => setTenderOnly(!tenderOnly)}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
              tenderOnly
                ? 'bg-blue-900 text-white shadow-2xs font-semibold'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            <span>⭐</span>
            <span>Tender & Partner Tier Only</span>
          </button>

          {/* Status selector */}
          <div className="flex items-center gap-1">
            {['All', 'Completed', 'In Progress', 'Planned'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-navy-800 text-white shadow-2xs font-semibold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Certifications */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm font-medium text-slate-600">Loading certification matrix...</p>
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-4xl mb-3">🛡️</div>
          <h3 className="text-base font-bold text-navy-950">No certifications found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {search || activeVendor !== 'All' || statusFilter !== 'All' || tenderOnly
              ? 'No certifications match your selected ecosystem or filters.'
              : 'Add staff certifications across AWS, SAP, Esri, and OpenText to build your enterprise capability matrix.'}
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={onOpenCreate}>
              + Register First Certification
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCerts.map((c) => {
            const theme = ECOSYSTEM_THEMES[c.ecosystem] || ECOSYSTEM_THEMES.Other;
            const exp = getExpiryDetails(c.expiryDate);
            return (
              <Card
                key={c._id}
                className={`relative group hover:border-slate-300 transition-all ${
                  exp?.status === 'expired'
                    ? 'border-red-200/80 bg-red-50/10'
                    : exp?.status === 'warning'
                    ? 'border-amber-200/80 bg-amber-50/10'
                    : ''
                }`}
              >
                <div className="space-y-3.5">
                  {/* Top Ecosystem & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${theme.badge}`}
                      >
                        <span>{theme.icon}</span>
                        <span>{c.ecosystem === 'Other' ? c.customEcosystem || 'Other' : c.ecosystem}</span>
                      </span>

                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          STATUS_BADGES[c.progress] || STATUS_BADGES.Planned
                        }`}
                      >
                        {c.progress}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg text-xs"
                        title="Edit Certification"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onArchive(c)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-xs cursor-pointer"
                        title={c.archived ? 'Put back on the list' : 'Archive'}
                      >
                        {c.archived ? '↩️' : '📦'}
                      </button>
                      {c.archived && (
                        <button
                          onClick={() => onDelete(c)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs cursor-pointer"
                          title="Delete for good"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="text-base font-bold text-navy-900 tracking-tight leading-snug">
                      {c.title}
                    </h3>
                  </div>

                  {/* Candidate */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                    <div className="w-6 h-6 rounded-full bg-navy-100 text-navy-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                      {c.candidate ? c.candidate.slice(0, 2).toUpperCase() : '??'}
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Certified Staff
                      </span>
                      <span className="font-semibold text-navy-900 truncate block">
                        {c.candidate}
                      </span>
                    </div>
                  </div>

                  {/* Tender Impact Badge */}
                  {c.tenderPartnerImpact && (
                    <div className="p-2 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-center gap-1.5 text-[11px] font-semibold text-blue-900">
                      <span>⭐</span>
                      <span>Counts toward Official Partner Tier / Bidding</span>
                    </div>
                  )}

                  {/* Credential ID / Verification URL */}
                  {c.credentialIdUrl && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                      <span className="text-slate-400">🔗</span>
                      {c.credentialIdUrl.startsWith('http') ? (
                        <a
                          href={c.credentialIdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy-700 hover:underline font-medium truncate max-w-[220px]"
                        >
                          Verify Credential &rarr;
                        </a>
                      ) : (
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          ID: {c.credentialIdUrl}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Dates & Expiry Alert */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                    {c.issueDate && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Issued:</span>
                        <span className="font-medium text-slate-700">{formatDate(c.issueDate)}</span>
                      </div>
                    )}

                    {exp && (
                      <div
                        className={`text-xs px-2.5 py-1 rounded-lg border flex items-center justify-between ${exp.badgeClass}`}
                      >
                        <span>{exp.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Action Footer */}
                  {c.progress !== 'Completed' && (
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => onQuickStatus(c._id, 'Completed')}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                      >
                        <span>✓</span> Mark as Completed & Certified
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CertificationTab;
