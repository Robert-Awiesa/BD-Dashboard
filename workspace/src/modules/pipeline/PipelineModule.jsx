import { useState } from 'react';
import OverviewModule from './OverviewModule';
import ColdCallsModule from './ColdCallsModule';
import ProspectingLeadsModule from './ProspectingLeadsModule';
import NewIndustryModule from './NewIndustryModule';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'cold-calls', label: 'Cold Calls' },
  { key: 'prospecting', label: 'Prospecting Leads' },
  { key: 'new-industry', label: 'New Industry' },
];

const PipelineModule = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Pipeline Tracker</h1>
        <p className="text-sm text-slate-600">Cold calls, prospecting leads, and new industry verticals.</p>
      </div>

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

      {activeTab === 'overview' && <OverviewModule onNavigate={setActiveTab} />}
      {activeTab === 'cold-calls' && <ColdCallsModule />}
      {activeTab === 'prospecting' && <ProspectingLeadsModule />}
      {activeTab === 'new-industry' && <NewIndustryModule />}
    </div>
  );
};

export default PipelineModule;
