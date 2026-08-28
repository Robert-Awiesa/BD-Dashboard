import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { bdApi } from '../../../context/services/api';

const ECOSYSTEM_OPTIONS = ['SAP', 'AWS', 'Esri', 'OpenText', 'Other'];
const PROGRESS_OPTIONS = ['Planned', 'In Progress', 'Completed'];

const CERT_PRESETS = {
  AWS: [
    'AWS Certified Solutions Architect - Associate',
    'AWS Certified Solutions Architect - Professional',
    'AWS Certified DevOps Engineer - Professional',
    'AWS Certified Security - Specialty',
    'AWS Certified Cloud Practitioner',
  ],
  SAP: [
    'SAP Certified Application Associate - SAP S/4HANA Cloud',
    'SAP Certified Technology Associate - SAP HANA 2.0',
    'SAP Certified Development Associate - ABAP with SAP NetWeaver',
    'SAP Certified Associate - Integration Suite',
  ],
  Esri: [
    'ArcGIS Pro Associate',
    'Enterprise Administration Associate',
    'ArcGIS API for JavaScript Specialty',
    'Spatial Analytics Professional',
  ],
  OpenText: [
    'OpenText Content Suite Certified Administrator',
    'OpenText Extended ECM Specialist',
    'OpenText AppWorks Developer Certification',
  ],
};

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const emptyForm = {
  title: '',
  ecosystem: 'AWS',
  customEcosystem: '',
  candidate: '',
  progress: 'Planned',
  credentialIdUrl: '',
  issueDate: '',
  expiryDate: '',
  tenderPartnerImpact: false,
};

const CertificationFormModal = ({ open, onClose, onSaved, existing = null }) => {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(() =>
    existing
      ? {
          ...emptyForm,
          ...existing,
          issueDate: toDateInput(existing.issueDate),
          expiryDate: toDateInput(existing.expiryDate),
        }
      : emptyForm
  );

  const [roster, setRoster] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existing) {
      setForm({
        ...emptyForm,
        ...existing,
        issueDate: toDateInput(existing.issueDate),
        expiryDate: toDateInput(existing.expiryDate),
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [existing, open]);

  useEffect(() => {
    let ignore = false;
    bdApi
      .getTeamRoster()
      .then((rows) => {
        if (!ignore) setRoster(rows.map((r) => r.name).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      return setError('Please enter the certification name or title.');
    }
    if (!form.candidate.trim()) {
      return setError('Please specify the candidate or team member.');
    }
    if (form.ecosystem === 'Other' && !form.customEcosystem.trim()) {
      return setError('Please specify the custom product ecosystem name.');
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        issueDate: form.issueDate ? new Date(form.issueDate) : null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate) : null,
      };

      const result = isEdit
        ? await bdApi.updateCertification(existing._id, payload)
        : await bdApi.addCertification(payload);

      onSaved(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const presets = CERT_PRESETS[form.ecosystem] || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Certification: ${existing.title}` : 'Register Enterprise Certification'}
      description="Track vendor credentials (AWS, SAP, Esri, OpenText) essential for partner tiers & tender compliance."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            🛡️ Ecosystem: <span className="font-semibold text-navy-800">{form.ecosystem === 'Other' ? form.customEcosystem || 'Custom' : form.ecosystem}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" form="cert-form" type="submit" disabled={busy}>
              {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Certification'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="cert-form" onSubmit={submit} className="space-y-5">
        {error && (
          <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {/* Ecosystem Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Product Ecosystem *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ECOSYSTEM_OPTIONS.map((eco) => {
              const isSelected = form.ecosystem === eco;
              return (
                <button
                  key={eco}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, ecosystem: eco }))}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    isSelected
                      ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {eco === 'AWS' && '☁️ AWS'}
                  {eco === 'SAP' && '🏢 SAP'}
                  {eco === 'Esri' && '🗺️ Esri'}
                  {eco === 'OpenText' && '📁 OpenText'}
                  {eco === 'Other' && '✨ Other'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Custom Ecosystem Input */}
        {form.ecosystem === 'Other' && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl animate-fade-in">
            <label className="block text-xs font-semibold text-amber-900 mb-1">
              Custom Product / Vendor Ecosystem Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Microsoft Azure, Cisco, Oracle, Google Cloud"
              value={form.customEcosystem}
              onChange={(e) => setForm((f) => ({ ...f, customEcosystem: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-amber-300 rounded-lg text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Certification Title / Credential Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g., AWS Certified Solutions Architect - Associate"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
          {presets.length > 0 && (
            <div className="mt-2">
              <span className="text-[11px] text-slate-400 block mb-1">Common {form.ecosystem} credentials:</span>
              <div className="flex flex-wrap gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, title: preset }))}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 hover:bg-navy-50 hover:text-navy-900 hover:border-navy-200 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Candidate & Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Candidate / Team Member *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Nana K. / Lead Engineer"
              value={form.candidate}
              onChange={(e) => setForm((f) => ({ ...f, candidate: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
            {roster.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {roster.slice(0, 5).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, candidate: name }))}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Progress & Status
            </label>
            <select
              value={form.progress}
              onChange={(e) => setForm((f) => ({ ...f, progress: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            >
              {PROGRESS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === 'Planned' && '🗓️ Planned (Preparing)'}
                  {status === 'In Progress' && '⏳ In Progress (Enrolled / Scheduled)'}
                  {status === 'Completed' && '✅ Completed (Certified & Active)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Credential ID / Verification Badge URL */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Credential ID / Badge Verification URL{' '}
            <span className="text-slate-400 font-normal">(Crucial for Tender Audits)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Credly URL (https://credly.com/...) or Certificate serial number"
            value={form.credentialIdUrl}
            onChange={(e) => setForm((f) => ({ ...f, credentialIdUrl: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
          />
        </div>

        {/* Issue Date & Expiry Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date</label>
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Expiry Date <span className="text-amber-600 font-normal">(Renewal tracking)</span>
            </label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-600/20 focus:border-navy-600"
            />
          </div>
        </div>

        {/* Tender & Partner Tier Impact Toggle */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start gap-3">
          <input
            type="checkbox"
            id="tenderPartnerImpact"
            checked={form.tenderPartnerImpact}
            onChange={(e) => setForm((f) => ({ ...f, tenderPartnerImpact: e.target.checked }))}
            className="mt-1 w-4 h-4 text-navy-700 rounded border-slate-300 focus:ring-navy-600"
          />
          <label htmlFor="tenderPartnerImpact" className="text-xs text-navy-950 cursor-pointer">
            <span className="font-semibold text-navy-900 block">
              ⭐ Counts toward Official Partner Tier or Tender Compliance
            </span>
            <span className="text-slate-500 block mt-0.5">
              Check this if this certified staff member directly satisfies partner requirements (e.g., AWS Advanced Consulting Partner, SAP Silver/Gold tier, public tender bidding minimums).
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};

export default CertificationFormModal;
