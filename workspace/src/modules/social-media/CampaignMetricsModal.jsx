import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import TagInput from '../../components/common/TagInput';
import { bdApi } from '../../context/services/api';
import { PLATFORM_METRIC_FIELDS, emptyMetricsFor } from './campaignConstants';

// Keyed by campaign._id from the parent (see CampaignsTab), so React remounts
// this component — and re-derives drafts from the fresh campaign — whenever a
// different campaign is opened, without resetting in-progress edits on every
// save-triggered campaign refresh within the same session.
const CampaignMetricsModal = ({ open, onClose, campaign, onUpdated }) => {
  const platforms = campaign?.platforms || [];

  const buildDrafts = () => {
    const nextDrafts = {};
    platforms.forEach((platform) => {
      const existing = campaign.platformMetrics?.find((pm) => pm.platform === platform);
      nextDrafts[platform] = existing ? { ...emptyMetricsFor(platform), ...existing.metrics } : emptyMetricsFor(platform);
    });
    return nextDrafts;
  };

  const [activeTab, setActiveTab] = useState(platforms[0] || 'insights');
  const [drafts, setDrafts] = useState(() => (campaign ? buildDrafts() : {}));
  const [insightsDraft, setInsightsDraft] = useState(() => ({
    areasOfConcern: campaign?.insights?.areasOfConcern || [],
    positiveTrends: campaign?.insights?.positiveTrends || [],
    keyOpportunities: campaign?.insights?.keyOpportunities || [],
    growthStrategyNotes: campaign?.insights?.growthStrategyNotes || [],
  }));
  const [savingTab, setSavingTab] = useState(null);
  const [error, setError] = useState(null);

  if (!campaign) return null;

  const isDone = (platform) => campaign.platformMetrics?.some((pm) => pm.platform === platform);

  const updateField = (platform, key, value) => {
    setDrafts((d) => ({ ...d, [platform]: { ...d[platform], [key]: value } }));
  };

  const handleSavePlatform = async (platform) => {
    setSavingTab(platform);
    setError(null);
    try {
      const updated = await bdApi.saveCampaignPlatformMetrics(campaign._id, platform, drafts[platform]);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTab(null);
    }
  };

  const handleSaveInsights = async () => {
    setSavingTab('insights');
    setError(null);
    try {
      const updated = await bdApi.saveCampaignInsights(campaign._id, insightsDraft);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTab(null);
    }
  };

  const tabs = [...platforms, 'insights'];

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <Badge label={campaign.status} status={campaign.status === 'Completed' ? 'success' : campaign.status === 'Reschedule Needed' ? 'danger' : 'active'} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        {activeTab !== 'insights' ? (
          <Button type="button" variant="primary" onClick={() => handleSavePlatform(activeTab)} disabled={savingTab === activeTab}>
            {savingTab === activeTab ? 'Saving...' : `Save ${activeTab} Metrics`}
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={handleSaveInsights} disabled={savingTab === 'insights'}>
            {savingTab === 'insights' ? 'Saving...' : 'Save Insights'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Performance Matrix"
      description={campaign.campaignName}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'insights' ? 'Insights & Summary' : tab}
              {tab !== 'insights' && isDone(tab) && <span className="text-forest-600">✓</span>}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {activeTab !== 'insights' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {(PLATFORM_METRIC_FIELDS[activeTab] || []).map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-slate-600 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={drafts[activeTab]?.[field.key] ?? ''}
                    onChange={(e) => updateField(activeTab, field.key, e.target.value)}
                    className="w-full form-input"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              {!PLATFORM_METRIC_FIELDS[activeTab] && (
                <p className="text-sm text-slate-500 col-span-2">No metric template defined for {activeTab} yet.</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">⚠ Areas of Concern</label>
                <TagInput value={insightsDraft.areasOfConcern} onChange={(v) => setInsightsDraft((d) => ({ ...d, areasOfConcern: v }))} placeholder="Add a concern..." />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">✅ Positive Trends</label>
                <TagInput value={insightsDraft.positiveTrends} onChange={(v) => setInsightsDraft((d) => ({ ...d, positiveTrends: v }))} placeholder="Add a trend..." />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">🎯 Key Opportunities</label>
                <TagInput value={insightsDraft.keyOpportunities} onChange={(v) => setInsightsDraft((d) => ({ ...d, keyOpportunities: v }))} placeholder="Add an opportunity..." />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">📈 Growth Strategy Notes</label>
                <TagInput value={insightsDraft.growthStrategyNotes} onChange={(v) => setInsightsDraft((d) => ({ ...d, growthStrategyNotes: v }))} placeholder="Add a next step..." />
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

export default CampaignMetricsModal;
