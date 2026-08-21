import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import {
  INDUSTRY_OPTIONS,
  OPPORTUNITY_STAGES,
  PROSPECTING_FIELDS,
  PROSPECTING_FIELD_LABELS,
  emptyProspectingForm,
} from './prospectingConstants';

const TABS = { MANUAL: 'manual', UPLOAD: 'upload' };

const downloadTemplate = () => {
  const headerRow = PROSPECTING_FIELDS.map((f) => PROSPECTING_FIELD_LABELS[f]);
  const sampleRow = [
    'Acme Corp', 'Oil and Gas', '', 'Jane Doe', 'Head of Procurement',
    'Slow vendor onboarding', 'Faster onboarding workflow', 'Cost savings angle',
    'Unqualified', 'jane@acme.com', '', '+1 555 0100', '', 'linkedin.com/in/janedoe',
    'acme.com', 'Houston, USA', 'What is your current vendor onboarding process?',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
  ws['!cols'] = headerRow.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prospecting Leads');
  XLSX.writeFile(wb, 'prospecting-leads-template.xlsx');
};

const LABEL_TO_FIELD = Object.fromEntries(
  Object.entries(PROSPECTING_FIELD_LABELS).map(([field, label]) => [label.toLowerCase(), field])
);

const normalizeRow = (row) => {
  // Map either DB field keys or human-readable template labels to schema keys.
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const trimmedKey = String(key).trim();
    const field = PROSPECTING_FIELDS.includes(trimmedKey)
      ? trimmedKey
      : LABEL_TO_FIELD[trimmedKey.toLowerCase()];
    if (field) {
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    }
  });
  if (!normalized.opportunityStage || !OPPORTUNITY_STAGES.includes(normalized.opportunityStage)) {
    normalized.opportunityStage = 'Unqualified';
  }
  return normalized;
};


// Stored records use null for unset fields, but an <input value> must never be
// null or React switches the field to uncontrolled. Prefill through this.
const fromRecord = (blank, record) => {
  const out = { ...blank };
  for (const key of Object.keys(blank)) {
    const value = record[key];
    out[key] = value === null || value === undefined ? blank[key] : value;
  }
  return out;
};

// `editing` prefills the form to correct an existing lead. The parent gives the
// modal a key of the lead id, so React remounts it and this initial state is
// simply right — no effect syncing props into state.
const ProspectingModal = ({ open, onClose, onSubmitManual, onSubmitBulk, submitting, editing = null }) => {
  const [activeTab, setActiveTab] = useState(TABS.MANUAL);
  const [form, setForm] = useState(
    editing ? fromRecord(emptyProspectingForm, editing) : emptyProspectingForm
  );
  const [formError, setFormError] = useState(null);

  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const resetState = () => {
    setActiveTab(TABS.MANUAL);
    setForm(emptyProspectingForm);
    setFormError(null);
    setParsedRows([]);
    setParseError(null);
    setFileName('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.company.trim() || !form.contactPerson.trim() || !form.primaryEmail.trim() || !form.primaryContact.trim()) {
      setFormError('Please fill in all required fields: Company, Contact Person, Primary Email, Primary Contact.');
      return;
    }
    if (form.industry === 'Others' && !form.customIndustry.trim()) {
      setFormError('Please specify the industry.');
      return;
    }
    try {
      await onSubmitManual(form);
      if (!editing) resetState();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const parseFile = (file) => {
    setParseError(null);
    setParsedRows([]);
    setFileName(file.name);

    const validExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!validExt) {
      setParseError('Unsupported file type. Please upload a .xlsx, .xls, or .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) {
          setParseError('No rows found in the uploaded file.');
          return;
        }
        const normalized = rows.map(normalizeRow).filter((r) => r.company);
        if (normalized.length === 0) {
          setParseError('No valid rows found. Make sure the "Company" column is populated.');
          return;
        }
        setParsedRows(normalized);
      } catch (err) {
        setParseError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.onerror = () => setParseError('Failed to read file.');
    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleBulkSubmit = async () => {
    setParseError(null);
    try {
      await onSubmitBulk(parsedRows);
      resetState();
    } catch (err) {
      setParseError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={editing ? 'Edit Lead' : 'New Pipeline Item'}>
      <div className={`flex gap-1 mb-5 border-b border-slate-200 ${editing ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => setActiveTab(TABS.MANUAL)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === TABS.MANUAL
              ? 'border-navy-700 text-navy-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Manual Entry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(TABS.UPLOAD)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === TABS.UPLOAD
              ? 'border-navy-700 text-navy-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Excel Bulk Upload
        </button>
      </div>

      {activeTab === TABS.MANUAL ? (
        <form onSubmit={handleManualSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Company *</label>
              <input type="text" required value={form.company} onChange={updateForm('company')} className="w-full form-input" placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Contact Person *</label>
              <input type="text" required value={form.contactPerson} onChange={updateForm('contactPerson')} className="w-full form-input" placeholder="e.g. Jane Doe" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Industry *</label>
              <select required value={form.industry} onChange={updateForm('industry')} className="w-full form-input">
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {form.industry === 'Others' ? (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Please specify industry</label>
                <input type="text" value={form.customIndustry} onChange={updateForm('customIndustry')} className="w-full form-input" placeholder="Specify industry" />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Position</label>
                <input type="text" value={form.position} onChange={updateForm('position')} className="w-full form-input" placeholder="e.g. Head of Procurement" />
              </div>
            )}
          </div>

          {form.industry === 'Others' && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Position</label>
              <input type="text" value={form.position} onChange={updateForm('position')} className="w-full form-input" placeholder="e.g. Head of Procurement" />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-600 mb-1">Company Challenge</label>
            <textarea value={form.companyChallenge} onChange={updateForm('companyChallenge')} rows={2} className="w-full form-input resize-none" placeholder="Pain points identified" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Proposed Solution</label>
            <textarea value={form.proposedSolution} onChange={updateForm('proposedSolution')} rows={2} className="w-full form-input resize-none" placeholder="Value proposition matching" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Strategic Angle</label>
              <input type="text" value={form.strategicAngle} onChange={updateForm('strategicAngle')} className="w-full form-input" placeholder="Hook or positioning angle" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Opportunity Stage</label>
              <select value={form.opportunityStage} onChange={updateForm('opportunityStage')} className="w-full form-input">
                {OPPORTUNITY_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Primary Email *</label>
              <input type="email" required value={form.primaryEmail} onChange={updateForm('primaryEmail')} className="w-full form-input" placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Other Email</label>
              <input type="email" value={form.otherEmail} onChange={updateForm('otherEmail')} className="w-full form-input" placeholder="optional" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Primary Contact *</label>
              <input type="tel" required value={form.primaryContact} onChange={updateForm('primaryContact')} className="w-full form-input" placeholder="+1 555 0100" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Other Contact</label>
              <input type="tel" value={form.otherContact} onChange={updateForm('otherContact')} className="w-full form-input" placeholder="optional" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">LinkedIn</label>
              <input type="url" value={form.linkedin} onChange={updateForm('linkedin')} className="w-full form-input" placeholder="linkedin.com/in/..." />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Company Website</label>
              <input type="url" value={form.companyWebsite} onChange={updateForm('companyWebsite')} className="w-full form-input" placeholder="company.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Location</label>
            <input type="text" value={form.location} onChange={updateForm('location')} className="w-full form-input" placeholder="City, Country" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Discovery Questions</label>
            <textarea value={form.discoveryQuestions} onChange={updateForm('discoveryQuestions')} rows={3} className="w-full form-input resize-none" placeholder="Key questions to ask during discovery calls" />
          </div>

          {formError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{formError}</div>
          )}

          <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur-sm">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Save Lead'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-600">
              Download the template to ensure your spreadsheet columns match the database fields exactly.
            </p>
            <Button type="button" variant="secondary" onClick={downloadTemplate} className="whitespace-nowrap">
              ⬇ Template
            </Button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center text-center gap-2 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragActive ? 'border-navy-500 bg-navy-50' : 'border-slate-300 hover:border-navy-300 hover:bg-slate-50'
            }`}
          >
            <span className="text-3xl">📄</span>
            <p className="text-sm font-medium text-navy-800">
              {fileName || 'Drag & drop your file here, or click to browse'}
            </p>
            <p className="text-xs text-slate-500">Accepts .xlsx, .xls, or .csv</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {parseError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{parseError}</div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-forest-700 font-medium">
                ✓ {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} ready to import
              </p>
              <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-600">Company</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-600">Contact Person</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-600">Industry</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-600">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 text-slate-700">{row.company}</td>
                        <td className="px-2 py-1.5 text-slate-700">{row.contactPerson}</td>
                        <td className="px-2 py-1.5 text-slate-700">{row.industry}</td>
                        <td className="px-2 py-1.5 text-slate-700">{row.opportunityStage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 8 && (
                  <p className="text-center text-[11px] text-slate-500 py-1.5 bg-slate-50">
                    + {parsedRows.length - 8} more row{parsedRows.length - 8 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur-sm">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              type="button"
              variant="primary"
              disabled={submitting || parsedRows.length === 0}
              onClick={handleBulkSubmit}
            >
              {submitting ? 'Importing...' : `Import ${parsedRows.length || ''} Lead${parsedRows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ProspectingModal;
