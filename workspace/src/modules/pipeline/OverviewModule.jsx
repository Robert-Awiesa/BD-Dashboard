import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Badge from '../../components/common/Badge';
import { CALL_OUTCOME_SHORT_LABEL } from './coldCallConstants';

const PRIORITY_BADGE_STATUS = { High: 'danger', Medium: 'ongoing', Low: 'cold' };

const formatShortDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const OverviewModule = ({ onNavigate }) => {
  const [coldCalls, setColdCalls] = useState([]);
  const [prospectingLeads, setProspectingLeads] = useState([]);
  const [newIndustryItems, setNewIndustryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getColdCalls(),
      bdApi.getProspectingLeads(),
      bdApi.getPipeline(),
    ])
      .then(([calls, leads, pipeline]) => {
        if (ignore) return;
        setColdCalls(calls);
        setProspectingLeads(leads);
        setNewIndustryItems(pipeline.filter((item) => item.type === 'New Industry'));
      })
      .catch((err) => {
        console.error('Failed to load overview data:', err);
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 skeleton rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
        ⚠️ Failed to load pipeline overview data: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {/* 1. Cold Calls Card */}
      <div
        onClick={() => onNavigate('cold-calls')}
        className="group relative bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-lg hover:border-red-300 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-navy-800" />

        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 border border-red-100 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                📞
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950 group-hover:text-red-700 transition-colors">
                  Cold Calls
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Outbound call logs & contact validation</p>
              </div>
            </div>
            <span className="min-w-8 h-8 px-2.5 rounded-full bg-red-50 text-red-800 border border-red-200 font-extrabold text-xs flex items-center justify-center shrink-0">
              {coldCalls.length}
            </span>
          </div>

          {/* Body Content */}
          <div className="mt-5 space-y-2.5">
            {coldCalls.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                <span className="text-2xl block mb-1">📞</span>
                <p className="text-xs font-semibold text-slate-700">No outbound calls logged yet</p>
                <p className="text-[11px] text-slate-400">Click to record new phone interactions</p>
              </div>
            ) : (
              coldCalls.slice(0, 3).map((call) => (
                <div
                  key={call._id}
                  className="p-3 bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200/80 hover:border-red-200 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-navy-950 text-xs truncate">
                      {call.prospectName}
                    </span>
                    <Badge
                      label={CALL_OUTCOME_SHORT_LABEL[call.callOutcome] || call.callOutcome}
                      status={call.callOutcome === 'Connected - Interested' ? 'success' : call.callOutcome === 'Wrong Number / Invalid Contact' ? 'danger' : 'ongoing'}
                    />
                  </div>
                  {call.phoneNumber && (
                    <p className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                      <span className="text-slate-400">📞</span> {call.phoneNumber}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-red-700 group-hover:text-red-800">
          <span>View All Call Logs</span>
          <span className="group-hover:translate-x-1 transition-transform">Explore →</span>
        </div>
      </div>

      {/* 2. Prospecting Leads Card */}
      <div
        onClick={() => onNavigate('prospecting')}
        className="group relative bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-lg hover:border-emerald-300 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-navy-900" />

        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🎯
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950 group-hover:text-emerald-700 transition-colors">
                  Prospecting Leads
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Leads under active research & qualification</p>
              </div>
            </div>
            <span className="min-w-8 h-8 px-2.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-xs flex items-center justify-center shrink-0">
              {prospectingLeads.length}
            </span>
          </div>

          {/* Body Content */}
          <div className="mt-5 space-y-2.5">
            {prospectingLeads.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                <span className="text-2xl block mb-1">🎯</span>
                <p className="text-xs font-semibold text-slate-700">No active prospecting leads</p>
                <p className="text-[11px] text-slate-400">Add corporate prospects to track stages</p>
              </div>
            ) : (
              prospectingLeads.slice(0, 3).map((lead) => (
                <div
                  key={lead._id}
                  className="p-3 bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200/80 hover:border-emerald-200 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-navy-950 text-xs truncate">
                      {lead.company}
                    </span>
                    <Badge label={lead.opportunityStage} status={lead.opportunityStage} />
                  </div>
                  {lead.contactPerson && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                      <span className="text-slate-400">👤</span> {lead.contactPerson}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">
          <span>View All Prospects</span>
          <span className="group-hover:translate-x-1 transition-transform">Explore →</span>
        </div>
      </div>

      {/* 3. New Industry Vertical Card */}
      <div
        onClick={() => onNavigate('new-industry')}
        className="group relative bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-lg hover:border-sky-300 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-800" />

        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🌐
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950 group-hover:text-sky-700 transition-colors">
                  New Industry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Vertical expansion & sector entry targets</p>
              </div>
            </div>
            <span className="min-w-8 h-8 px-2.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-extrabold text-xs flex items-center justify-center shrink-0">
              {newIndustryItems.length}
            </span>
          </div>

          {/* Body Content */}
          <div className="mt-5 space-y-2.5">
            {newIndustryItems.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                <span className="text-2xl block mb-1">🌐</span>
                <p className="text-xs font-semibold text-slate-700">No industry items yet</p>
                <p className="text-[11px] text-slate-400">Map new market sector targets & priority</p>
              </div>
            ) : (
              newIndustryItems.slice(0, 3).map((item) => {
                const followUp = formatShortDate(item.nextFollowUp);
                return (
                  <div
                    key={item._id}
                    className="p-3 bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200/80 hover:border-sky-200 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-navy-950 text-xs truncate">
                        {item.name}
                      </span>
                      {item.priority && (
                        <Badge label={item.priority} status={PRIORITY_BADGE_STATUS[item.priority]} />
                      )}
                    </div>
                    {followUp && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                        <span className="text-slate-400">📅</span> Next follow-up: {followUp}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-sky-700 group-hover:text-sky-800">
          <span>View Industry Pipeline</span>
          <span className="group-hover:translate-x-1 transition-transform">Explore →</span>
        </div>
      </div>
    </div>
  );
};

export default OverviewModule;
