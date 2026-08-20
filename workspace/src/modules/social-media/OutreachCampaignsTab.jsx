import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

const emptyCampaign = { name: '', owner: '', description: '' };
const emptyRecipient = { name: '', title: '', email: '', contact: '', company: '', notes: '' };
const emptyBatch = { subject: '', sentAt: new Date().toISOString().slice(0, 10), sentBy: '', note: '' };
const metricFields = [
  ['openedNoReplyPct', 'Viewed, no reply %'],
  ['repliedPct', 'Replied %'],
  ['notOpenedPct', 'Not opened %'],
  ['bouncedPct', 'Bounced %'],
];

const statusTone = (status) => {
  if (status === 'Replied') return 'success';
  if (status === 'No Reply' || status === 'Bounced') return 'danger';
  if (status === 'Sent') return 'active';
  return 'default';
};

const toDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-');

const normaliseRow = (row) => {
  const pick = (...names) => {
    const found = names.find((name) => row[name] !== undefined || row[name.toLowerCase()] !== undefined);
    return found ? String(row[found] ?? row[found.toLowerCase()] ?? '').trim() : '';
  };
  return {
    name: pick('Name', 'name'),
    title: pick('Title', 'title', 'Role', 'role'),
    email: pick('Email', 'email'),
    contact: pick('Contact', 'contact', 'Phone', 'phone', 'Phone Contact'),
    company: pick('Company', 'company'),
    notes: pick('Message', 'message', 'Notes', 'notes'),
  };
};

const OutreachCampaignsTab = ({ channel }) => {
  const isEmail = channel === 'Email';
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [recipientForm, setRecipientForm] = useState(emptyRecipient);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [metrics, setMetrics] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === selectedId) || campaigns[0],
    [campaigns, selectedId]
  );

  const statusOptions = useMemo(() => {
    if (!meta) return isEmail ? ['Not Sent', 'Sent', 'Replied', 'No Reply', 'Bounced'] : ['Not Sent', 'Sent', 'Replied', 'No Reply'];
    return isEmail ? meta.recipientStatuses : meta.smsRecipientStatuses;
  }, [isEmail, meta]);

  const loadCampaigns = async () => {
    const [metaData, statData, campaignData] = await Promise.all([
      bdApi.getOutreachMeta(),
      bdApi.getOutreachStats(channel),
      bdApi.getOutreachCampaigns({ channel }),
    ]);
    setMeta(metaData);
    setStats(statData.totals);
    setCampaigns(campaignData);
    if (!selectedId && campaignData[0]) setSelectedId(campaignData[0]._id);
    if (selectedId && !campaignData.some((c) => c._id === selectedId) && campaignData[0]) {
      setSelectedId(campaignData[0]._id);
    }
    if (campaignData.length === 0) {
      setSelectedId('');
      setRecipients([]);
    }
  };

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    loadCampaigns()
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [channel]);

  useEffect(() => {
    let ignore = false;
    if (!selectedCampaign?._id) return undefined;
    bdApi.getOutreachRecipients(selectedCampaign._id)
      .then((data) => {
        if (!ignore) setRecipients(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [selectedCampaign?._id]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshSelected = async (campaignId = selectedCampaign?._id) => {
    await loadCampaigns();
    if (campaignId) setRecipients(await bdApi.getOutreachRecipients(campaignId));
  };

  const createCampaign = (event) => {
    event.preventDefault();
    run(async () => {
      const created = await bdApi.addOutreachCampaign({ ...campaignForm, channel });
      setCampaignForm(emptyCampaign);
      setSelectedId(created._id);
      setMessage(`${channel} campaign created.`);
      await refreshSelected(created._id);
    });
  };

  const addRecipient = (event) => {
    event.preventDefault();
    if (!selectedCampaign) return;
    run(async () => {
      const created = await bdApi.addOutreachRecipient(selectedCampaign._id, recipientForm);
      setRecipientForm(emptyRecipient);
      setRecipients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      await refreshSelected(selectedCampaign._id);
    });
  };

  const updateRecipient = (recipient, field, value) => {
    const next = { ...recipient, [field]: value };
    setRecipients((prev) => prev.map((item) => (item._id === recipient._id ? next : item)));
    run(async () => {
      const updated = await bdApi.updateOutreachRecipient(recipient._id, { [field]: value });
      setRecipients((prev) => prev.map((item) => (item._id === recipient._id ? updated : item)));
    });
  };

  const importSheet = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCampaign) return;
    run(async () => {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(normaliseRow);
      const result = await bdApi.bulkAddOutreachRecipients(selectedCampaign._id, rows);
      setMessage(`Imported ${result.imported}. Skipped ${result.skipped}.${result.errors.length ? ` Errors: ${result.errors.join('; ')}` : ''}`);
      await refreshSelected(selectedCampaign._id);
    });
  };

  const logBatch = (event) => {
    event.preventDefault();
    if (!selectedCampaign) return;
    run(async () => {
      const updated = await bdApi.logOutreachBatch(selectedCampaign._id, batchForm);
      setBatchForm(emptyBatch);
      setSelectedId(updated._id);
      setMessage(`Logged send batch ${updated.batches?.at(-1)?.batchNumber || ''}.`);
      await refreshSelected(updated._id);
    });
  };

  const saveMetrics = (batchId) => {
    run(async () => {
      const updated = await bdApi.saveOutreachBatchMetrics(selectedCampaign._id, batchId, metrics[batchId] || {});
      setCampaigns((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setMessage('Metrics saved.');
      await refreshSelected(updated._id);
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Campaigns', stats?.campaigns ?? 0],
          ['Recipients', stats?.recipients ?? 0],
          ['Contacted', stats?.contacted ?? 0],
          ['Replies', stats?.replied ?? 0],
          [isEmail ? 'Awaiting metrics' : 'Sends logged', isEmail ? stats?.awaitingMetrics ?? 0 : stats?.sends ?? 0],
        ].map(([label, value]) => (
          <Card key={label} className="py-4 text-center">
            <span className="text-2xl font-bold text-navy-900">{value}</span>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <form onSubmit={createCampaign} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <label className="md:col-span-2">
            <span className="field-label">Campaign name</span>
            <input className="form-input" value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>
          <label>
            <span className="field-label">Owner</span>
            <input className="form-input" value={campaignForm.owner} onChange={(e) => setCampaignForm((f) => ({ ...f, owner: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Open list</span>
            <select className="form-input" value={selectedCampaign?._id || ''} onChange={(e) => setSelectedId(e.target.value)}>
              {campaigns.map((campaign) => (
                <option key={campaign._id} value={campaign._id}>{campaign.name}</option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy}>{busy ? 'Working...' : `New ${channel}`}</Button>
        </form>
      </Card>

      {error && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}
      {message && <div className="p-3 rounded-lg border border-forest-200 bg-forest-50 text-sm text-forest-700">{message}</div>}

      {!selectedCampaign && !loading ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg bg-white">
          Create a {channel.toLowerCase()} campaign to start building the list.
        </div>
      ) : (
        <div className="space-y-5">
          <Card title={selectedCampaign?.name || `${channel} campaign`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <Badge label={selectedCampaign?.status || 'Draft'} status={selectedCampaign?.status === 'Completed' ? 'success' : 'active'} />
                <span>{recipients.length} people</span>
                <span>{selectedCampaign?.batchCount || selectedCampaign?.batches?.length || 0} sends</span>
                {isEmail && selectedCampaign?.overallMetrics && (
                  <span>{selectedCampaign.overallMetrics.repliedPct}% replied overall</span>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
                <span>Upload Excel/CSV</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={importSheet} className="sr-only" />
              </label>
            </div>

            <form onSubmit={addRecipient} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
              <input className="form-input" placeholder="Name" value={recipientForm.name} onChange={(e) => setRecipientForm((f) => ({ ...f, name: e.target.value }))} required />
              {isEmail && <input className="form-input" placeholder="Title" value={recipientForm.title} onChange={(e) => setRecipientForm((f) => ({ ...f, title: e.target.value }))} />}
              {isEmail && <input className="form-input" placeholder="Email" type="email" value={recipientForm.email} onChange={(e) => setRecipientForm((f) => ({ ...f, email: e.target.value }))} required />}
              <input className="form-input" placeholder={isEmail ? 'Contact' : 'Phone contact'} value={recipientForm.contact} onChange={(e) => setRecipientForm((f) => ({ ...f, contact: e.target.value }))} required={!isEmail} />
              {!isEmail && <input className="form-input" placeholder="Company" value={recipientForm.company} onChange={(e) => setRecipientForm((f) => ({ ...f, company: e.target.value }))} />}
              <input className="form-input md:col-span-1" placeholder={isEmail ? 'Message/details' : 'Notes'} value={recipientForm.notes} onChange={(e) => setRecipientForm((f) => ({ ...f, notes: e.target.value }))} />
              <Button type="submit" variant="secondary" disabled={busy}>Add</Button>
            </form>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    {isEmail && <th className="text-left px-3 py-2">Title</th>}
                    {isEmail && <th className="text-left px-3 py-2">Email</th>}
                    <th className="text-left px-3 py-2">Contact</th>
                    {!isEmail && <th className="text-left px-3 py-2">Company</th>}
                    <th className="text-left px-3 py-2">Editable message/details</th>
                    <th className="text-left px-3 py-2">Date sent</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Send count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.map((recipient) => (
                    <tr key={recipient._id}>
                      <td className="px-3 py-2"><input className="form-input text-sm" value={recipient.name || ''} onChange={(e) => updateRecipient(recipient, 'name', e.target.value)} /></td>
                      {isEmail && <td className="px-3 py-2"><input className="form-input text-sm" value={recipient.title || ''} onChange={(e) => updateRecipient(recipient, 'title', e.target.value)} /></td>}
                      {isEmail && <td className="px-3 py-2"><input className="form-input text-sm" value={recipient.email || ''} onChange={(e) => updateRecipient(recipient, 'email', e.target.value)} /></td>}
                      <td className="px-3 py-2"><input className="form-input text-sm" value={recipient.contact || ''} onChange={(e) => updateRecipient(recipient, 'contact', e.target.value)} /></td>
                      {!isEmail && <td className="px-3 py-2"><input className="form-input text-sm" value={recipient.company || ''} onChange={(e) => updateRecipient(recipient, 'company', e.target.value)} /></td>}
                      <td className="px-3 py-2"><textarea className="form-input text-sm min-w-56" rows={1} value={recipient.notes || ''} onChange={(e) => updateRecipient(recipient, 'notes', e.target.value)} /></td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{toDate(recipient.lastSentAt)}</td>
                      <td className="px-3 py-2">
                        <select className="form-input text-sm" value={recipient.currentStatus} onChange={(e) => updateRecipient(recipient, 'currentStatus', e.target.value)}>
                          {statusOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><Badge label={String(recipient.sendCount || 0)} status={statusTone(recipient.currentStatus)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Log ${channel} send`}>
            <form onSubmit={logBatch} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <label className="md:col-span-2">
                <span className="field-label">{isEmail ? 'Email subject' : 'SMS label'}</span>
                <input className="form-input" value={batchForm.subject} onChange={(e) => setBatchForm((f) => ({ ...f, subject: e.target.value }))} />
              </label>
              <label>
                <span className="field-label">Date sent</span>
                <input type="date" className="form-input" value={batchForm.sentAt} onChange={(e) => setBatchForm((f) => ({ ...f, sentAt: e.target.value }))} />
              </label>
              <label>
                <span className="field-label">Sent by</span>
                <input className="form-input" value={batchForm.sentBy} onChange={(e) => setBatchForm((f) => ({ ...f, sentBy: e.target.value }))} />
              </label>
              <Button type="submit" variant="success" disabled={busy || recipients.length === 0}>Log send</Button>
            </form>
          </Card>

          {isEmail && selectedCampaign?.batches?.length > 0 && (
            <Card title="Email batch metrics">
              <div className="space-y-3">
                {selectedCampaign.batches.map((batch) => (
                  <div key={batch._id} className="grid grid-cols-1 lg:grid-cols-[1fr_repeat(4,8rem)_auto] gap-2 items-end border border-slate-200 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-navy-900">Batch {batch.batchNumber}: {batch.subject || 'Untitled send'}</p>
                      <p className="text-xs text-slate-500">{toDate(batch.sentAt)} to {batch.recipientCount} recipients</p>
                    </div>
                    {metricFields.map(([key, label]) => (
                      <label key={key}>
                        <span className="field-label">{label}</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-input"
                          value={metrics[batch._id]?.[key] ?? batch.metrics?.[key] ?? ''}
                          onChange={(e) => setMetrics((prev) => ({ ...prev, [batch._id]: { ...(prev[batch._id] || {}), [key]: e.target.value } }))}
                        />
                      </label>
                    ))}
                    <Button variant="secondary" onClick={() => saveMetrics(batch._id)} disabled={busy}>Save</Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default OutreachCampaignsTab;
