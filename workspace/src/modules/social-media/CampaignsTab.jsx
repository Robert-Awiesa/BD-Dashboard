import { useEffect, useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import CampaignWizardModal from './CampaignWizardModal';
import CampaignMetricsModal from './CampaignMetricsModal';
import RescheduleModal from './RescheduleModal';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const statusBadge = (status) => {
  if (status === 'Completed') return 'success';
  if (status === 'Reschedule Needed') return 'danger';
  if (status === 'Active') return 'active';
  return 'default';
};

const CampaignsTab = ({ platformFilter }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showWizard, setShowWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [metricsCampaign, setMetricsCampaign] = useState(null);
  const [rescheduleCampaign, setRescheduleCampaign] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([bdApi.getCampaigns(), bdApi.getReminders('Campaign')])
      .then(([campaignData, reminderData]) => {
        if (ignore) return;
        setCampaigns(campaignData);
        setReminders(reminderData);
      })
      .catch((err) => {
        console.error('Failed to load campaigns:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const visibleCampaigns = useMemo(() => {
    if (!platformFilter) return campaigns;
    return campaigns.filter((c) => c.platforms?.includes(platformFilter));
  }, [campaigns, platformFilter]);

  const summary = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'Active' || c.status === 'Planning').length;
    const totalReach = campaigns.reduce((sum, c) => {
      const reach = (c.platformMetrics || []).reduce((s, pm) => {
        const m = pm.metrics || {};
        return s + Number(m.audienceReached || m.accountsReached || m.reach || m.impressions || 0);
      }, 0);
      return sum + reach;
    }, 0);
    const newFollowers = campaigns.reduce((sum, c) => {
      const followers = (c.platformMetrics || []).reduce((s, pm) => s + Number(pm.metrics?.newFollowers || 0), 0);
      return sum + followers;
    }, 0);
    return { active, totalReach, newFollowers };
  }, [campaigns]);

  const upsertCampaign = (campaign) => {
    setCampaigns((prev) => {
      const idx = prev.findIndex((c) => c._id === campaign._id);
      if (idx === -1) return [campaign, ...prev];
      const next = [...prev];
      next[idx] = campaign;
      return next;
    });
    setMetricsCampaign((prev) => (prev && prev._id === campaign._id ? campaign : prev));
    // The backend actions (closes) any open reminder once a campaign's metrics
    // are fully entered — mirror that here so the banner doesn't show a stale
    // "launches in N days" line for a campaign that's already Completed.
    if (campaign.status === 'Completed') {
      setReminders((prev) => prev.filter((r) => r.sourceId !== campaign._id));
    }
  };

  const handleCreateOrUpdate = async (formData) => {
    setSubmitting(true);
    try {
      if (editingCampaign) {
        const updated = await bdApi.updateCampaign(editingCampaign._id, formData);
        upsertCampaign(updated);
      } else {
        const created = await bdApi.addCampaign(formData);
        upsertCampaign(created);
      }
      setEditingCampaign(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign? This also removes its reminders and metrics.')) return;
    try {
      await bdApi.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c._id !== id));
      setReminders((prev) => prev.filter((r) => r.sourceId !== id));
    } catch (err) {
      alert(`Error deleting campaign: ${err.message}`);
    }
  };

  const handleReschedule = async (id, dates) => {
    const updated = await bdApi.rescheduleCampaign(id, dates);
    upsertCampaign(updated);
    setReminders((prev) => prev.filter((r) => r.sourceId !== id));
  };

  const handleActionReminder = async (reminder) => {
    try {
      await bdApi.actionReminder(reminder._id);
      setReminders((prev) => prev.filter((r) => r._id !== reminder._id));
    } catch (err) {
      alert(`Error dismissing reminder: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <span className="text-2xl font-bold text-navy-900">{summary.active}</span>
          <p className="text-xs text-slate-500 mt-1">Active Campaigns</p>
        </Card>
        <Card className="text-center py-4">
          <span className="text-2xl font-bold text-navy-900">{summary.totalReach.toLocaleString()}</span>
          <p className="text-xs text-slate-500 mt-1">Total Reach</p>
        </Card>
        <Card className="text-center py-4">
          <span className="text-2xl font-bold text-navy-900">{summary.newFollowers.toLocaleString()}</span>
          <p className="text-xs text-slate-500 mt-1">New Followers</p>
        </Card>
      </div>

      {reminders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            🔔 Reminders ({reminders.length})
          </h4>
          <div className="space-y-1.5">
            {reminders.map((r) => (
              <div key={r._id} className="flex items-start justify-between gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2">
                <div>
                  <span className={`text-xs font-medium ${r.reminderType === 'overdue' ? 'text-red-600' : 'text-amber-700'}`}>
                    {r.reminderType === 'overdue' ? 'OVERDUE' : 'UPCOMING'}
                  </span>
                  <p className="text-sm text-slate-700">{r.message}</p>
                  {r.responsiblePerson && <p className="text-xs text-slate-500">Owner: {r.responsiblePerson}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.reminderType === 'overdue' && (
                    <Button
                      variant="secondary"
                      className="text-xs px-2.5 py-1.5"
                      onClick={() => setRescheduleCampaign(campaigns.find((c) => c._id === r.sourceId))}
                    >
                      Reschedule
                    </Button>
                  )}
                  <button type="button" onClick={() => handleActionReminder(r)} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => { setEditingCampaign(null); setShowWizard(true); }}>
          + New Campaign
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to connect to backend: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
        </div>
      ) : visibleCampaigns.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-white">
          {platformFilter ? `No campaigns for ${platformFilter}.` : 'No campaigns yet. Click "+ New Campaign" to plan one.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleCampaigns.map((c) => (
            <div key={c._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-navy-900 text-sm">{c.campaignName}</span>
                <Badge label={c.status} status={statusBadge(c.status)} />
              </div>
              <div className="flex flex-wrap gap-1">
                {(c.platforms || []).map((p) => (
                  <span key={p} className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{p}</span>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {formatDate(c.startDate)} → {formatDate(c.endDate)}
              </p>
              <p className="text-xs text-slate-500">
                Budget: ${Number(c.budgetAmount).toLocaleString()} ({c.budgetType})
              </p>
              <p className="text-xs text-slate-500">Owner: {c.responsiblePerson}</p>

              <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-slate-100">
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditingCampaign(c); setShowWizard(true); }} className="text-navy-700 hover:underline text-xs cursor-pointer">Edit</button>
                  <button type="button" onClick={() => handleDelete(c._id)} className="text-red-600 hover:underline text-xs cursor-pointer">Delete</button>
                </div>
                <Button variant="success" className="text-xs px-2.5 py-1.5" onClick={() => setMetricsCampaign(c)}>
                  Enter Metrics
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignWizardModal
        key={editingCampaign?._id || 'new'}
        open={showWizard}
        onClose={() => { setShowWizard(false); setEditingCampaign(null); }}
        onSubmit={handleCreateOrUpdate}
        submitting={submitting}
        initialData={editingCampaign}
      />

      <CampaignMetricsModal
        key={metricsCampaign?._id}
        open={!!metricsCampaign}
        onClose={() => setMetricsCampaign(null)}
        campaign={metricsCampaign}
        onUpdated={upsertCampaign}
      />

      <RescheduleModal
        key={rescheduleCampaign?._id}
        open={!!rescheduleCampaign}
        onClose={() => setRescheduleCampaign(null)}
        campaign={rescheduleCampaign}
        onSubmit={handleReschedule}
        submitting={false}
      />
    </div>
  );
};

export default CampaignsTab;
