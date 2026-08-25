import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import TagInput from '../../components/common/TagInput';
import {
  LOCATION_TYPES, AD_FORMATS, PLACEMENT_SITES, BUDGET_TYPES,
  COMPANY_SIZES, AGE_RANGES, DEGREES, DEVICE_OPTIONS, emptyCampaignForm,
} from './campaignConstants';

const STEPS = ['Audience & Targeting', 'Format', 'Placement, Budget & Schedule'];

// Keyed by initialData?._id from the parent (see CampaignsTab), so state
// re-derives whenever a different campaign is opened for editing.
const CampaignWizardModal = ({ open, onClose, onSubmit, submitting, initialData }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialData || emptyCampaignForm);
  const [error, setError] = useState(null);

  const updateField = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const updateInput = (field) => (e) => updateField(field, e.target.value);

  const toggleInArray = (field, value) => {
    setForm((f) => {
      const arr = f[field] || [];
      return arr.includes(value)
        ? { ...f, [field]: arr.filter((v) => v !== value) }
        : { ...f, [field]: [...arr, value] };
    });
  };

  const handleClose = () => {
    setForm(emptyCampaignForm);
    setStep(0);
    setError(null);
    onClose();
  };

  const validateStep = () => {
    if (step === 0) {
      if (!form.campaignName.trim()) return 'Campaign name is required.';
      if (form.locationType !== 'Online' && !form.physicalLocation.trim()) {
        return 'Physical location is required for Physical or Hybrid campaigns.';
      }
    }
    if (step === 2) {
      if (form.platforms.length === 0) return 'Select at least one placement site.';
      if (!form.budgetAmount || Number(form.budgetAmount) <= 0) return 'Enter a valid budget amount.';
      if (!form.startDate || !form.endDate) return 'Start and end dates are required.';
      if (new Date(form.endDate) < new Date(form.startDate)) return 'End date cannot be before start date.';
      if (!form.responsiblePerson.trim()) return 'Responsible person is required.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    try {
      await onSubmit({ ...form, budgetAmount: Number(form.budgetAmount) });
      handleClose();
    } catch (submitErr) {
      setError(submitErr.message);
    }
  };

  const footer = (
    <div className="flex justify-between items-center gap-3">
      <Button type="button" variant="secondary" onClick={step === 0 ? handleClose : handleBack}>
        {step === 0 ? 'Cancel' : '← Back'}
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={handleNext}>Next →</Button>
        ) : (
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialData ? 'Edit Campaign' : 'New Campaign'}
      description={STEPS[step]}
      size="lg"
      footer={footer}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  idx === step ? 'bg-navy-700 text-white' : idx < step ? 'bg-forest-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {idx < step ? '✓' : idx + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${idx === step ? 'text-navy-800 font-medium' : 'text-slate-500'}`}>{label}</span>
              {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 min-w-4" />}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Campaign Name *</label>
                <input type="text" value={form.campaignName} onChange={updateInput('campaignName')} className="w-full form-input" placeholder="e.g. Q3 Enterprise Push" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Target Audience (job function/portfolio)</label>
                  <TagInput value={form.targetAudience} onChange={(v) => updateField('targetAudience', v)} placeholder="e.g. Heads of Sales" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Excluded Audience</label>
                  <TagInput value={form.excludedAudience} onChange={(v) => updateField('excludedAudience', v)} placeholder="e.g. Students" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Campaign Location</label>
                  <select value={form.locationType} onChange={updateInput('locationType')} className="w-full form-input">
                    {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {form.locationType !== 'Online' && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Physical Location *</label>
                    <input type="text" value={form.physicalLocation} onChange={updateInput('physicalLocation')} className="w-full form-input" placeholder="e.g. Accra Trade Fair" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Target Industries</label>
                  <TagInput value={form.targetIndustries} onChange={(v) => updateField('targetIndustries', v)} placeholder="e.g. Oil and Gas" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Target Companies</label>
                  <TagInput value={form.targetCompanies} onChange={(v) => updateField('targetCompanies', v)} placeholder="e.g. Acme Corp" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Company Size</label>
                  <select value={form.companySize} onChange={updateInput('companySize')} className="w-full form-input">
                    {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Company Annual Revenue ($)</label>
                  <input type="text" value={form.companyAnnualRevenue} onChange={updateInput('companyAnnualRevenue')} className="w-full form-input" placeholder="e.g. $1M-$5M" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1.5">Audience Degrees</label>
                <div className="flex flex-wrap gap-3">
                  {DEGREES.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={form.audienceDegrees.includes(d)} onChange={() => toggleInArray('audienceDegrees', d)} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Audience Age Range</label>
                  <select value={form.audienceAgeRange} onChange={updateInput('audienceAgeRange')} className="w-full form-input">
                    <option value="">Select…</option>
                    {AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5">Devices Audience Uses</label>
                  <div className="flex flex-wrap gap-3 pt-2">
                    {DEVICE_OPTIONS.map((d) => (
                      <label key={d} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={form.audienceDevices.includes(d)} onChange={() => toggleInArray('audienceDevices', d)} />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className="block text-xs text-slate-600 mb-2">Ad Format(s)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AD_FORMATS.map((fmt) => {
                  const active = form.adFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleInArray('adFormats', fmt)}
                      className={`px-3 py-2 rounded-lg border text-sm text-left cursor-pointer transition-colors ${
                        active ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-700 border-slate-300 hover:border-navy-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-2">Placement Sites *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PLACEMENT_SITES.map((site) => {
                    const active = form.platforms.includes(site);
                    return (
                      <button
                        key={site}
                        type="button"
                        onClick={() => toggleInArray('platforms', site)}
                        className={`px-3 py-2 rounded-lg border text-sm text-left cursor-pointer transition-colors ${
                          active ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-700 border-slate-300 hover:border-navy-300'
                        }`}
                      >
                        {site}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Budget Type</label>
                  <select value={form.budgetType} onChange={updateInput('budgetType')} className="w-full form-input">
                    {BUDGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Budget Amount ($) *</label>
                  <input type="number" min="0" step="0.01" value={form.budgetAmount} onChange={updateInput('budgetAmount')} className="w-full form-input" placeholder="e.g. 500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={updateInput('startDate')} className="w-full form-input" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">End Date *</label>
                  <input type="date" value={form.endDate} onChange={updateInput('endDate')} className="w-full form-input" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Responsible Person *</label>
                <input type="text" value={form.responsiblePerson} onChange={updateInput('responsiblePerson')} className="w-full form-input" placeholder="e.g. Thabo M." />
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
        )}
      </div>
    </Modal>
  );
};

export default CampaignWizardModal;
