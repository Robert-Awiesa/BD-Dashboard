import { useEffect, useMemo, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Card from '../../components/common/Card';
import { PLATFORMS } from './socialEngineConstants';
import ScheduleTab from './ScheduleTab';
import ScriptsTab from './ScriptsTab';
import ContentRepositoryTab from './ContentRepositoryTab';
import CampaignsTab from './CampaignsTab';
import OutreachCampaignsTab from './OutreachCampaignsTab';

const TABS = [
  { key: 'schedule', label: 'Monthly Schedule' },
  { key: 'scripts', label: 'Scripts Repository' },
  { key: 'content', label: 'Content Repository' },
  { key: 'campaigns', label: 'Online Campaign' },
  { key: 'email-campaigns', label: 'Email Campaigns' },
  { key: 'sms-campaigns', label: 'SMS Campaigns' },
];

const SocialMediaModule = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [platformFilter, setPlatformFilter] = useState(null);

  useEffect(() => {
    let ignore = false;
    bdApi.getSocialContent()
      .then((data) => {
        if (!ignore) setEntries(data);
      })
      .catch((err) => {
        console.error('Failed to load social content:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const visibleEntries = useMemo(() => {
    if (!platformFilter) return entries;
    return entries.filter((e) => e.platform === platformFilter);
  }, [entries, platformFilter]);

  // All titles across every entry, so pickers in one tab can smart-sync from another
  // (e.g. pulling a script's title straight into the scheduler) without re-typing.
  const allTitles = useMemo(() => {
    const seen = new Map();
    entries.forEach((e) => {
      if (e.title && !seen.has(e.title)) seen.set(e.title, e);
    });
    return Array.from(seen.values());
  }, [entries]);

  const upsertEntry = (entry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e._id === entry._id);
      if (idx === -1) return [entry, ...prev];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  };

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e._id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Social Media & Content Engine</h1>
        <p className="text-sm text-slate-600">Plan posts, store scripts, and archive published content in one synced workspace.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {PLATFORMS.map((plat) => {
          const isActive = platformFilter === plat.key;
          const count = entries.filter((e) => e.platform === plat.key).length;
          return (
            <Card
              key={plat.key}
              className={`text-center py-4 cursor-pointer transition-colors ${isActive ? 'border-navy-500 ring-1 ring-navy-300' : 'hover:border-navy-300'}`}
            >
              <button
                type="button"
                onClick={() => setPlatformFilter(isActive ? null : plat.key)}
                className="w-full cursor-pointer"
              >
                <span className="text-2xl">{plat.icon}</span>
                <h4 className="font-semibold text-slate-700 text-sm mt-1">{plat.label}</h4>
                <span className="text-xs text-forest-700 mt-1 block">{count} {count === 1 ? 'entry' : 'entries'}</span>
              </button>
              <a
                href={plat.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-slate-400 hover:text-navy-700 mt-1.5 inline-block"
              >
                Open ↗
              </a>
            </Card>
          );
        })}
      </div>

      {platformFilter && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          Filtering by <span className="font-semibold text-navy-800">{platformFilter}</span>
          <button type="button" onClick={() => setPlatformFilter(null)} className="text-navy-700 hover:underline cursor-pointer">
            Clear filter
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-navy-700 text-navy-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to connect to backend: {error}
        </div>
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          entries={visibleEntries}
          allTitles={allTitles}
          loading={loading}
          platformFilter={platformFilter}
          onCreated={upsertEntry}
          onUpdated={upsertEntry}
          onDeleted={removeEntry}
        />
      )}
      {activeTab === 'scripts' && (
        <ScriptsTab
          entries={visibleEntries}
          loading={loading}
          platformFilter={platformFilter}
          onCreated={upsertEntry}
          onUpdated={upsertEntry}
          onDeleted={removeEntry}
        />
      )}
      {activeTab === 'content' && (
        <ContentRepositoryTab
          entries={visibleEntries}
          allTitles={allTitles}
          loading={loading}
          platformFilter={platformFilter}
          onCreated={upsertEntry}
          onUpdated={upsertEntry}
          onDeleted={removeEntry}
        />
      )}
      {activeTab === 'campaigns' && (
        <CampaignsTab platformFilter={platformFilter} />
      )}
      {activeTab === 'email-campaigns' && (
        <OutreachCampaignsTab channel="Email" />
      )}
      {activeTab === 'sms-campaigns' && (
        <OutreachCampaignsTab channel="SMS" />
      )}
    </div>
  );
};

export default SocialMediaModule;
