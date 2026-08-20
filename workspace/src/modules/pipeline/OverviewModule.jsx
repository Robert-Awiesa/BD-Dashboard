import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { CALL_OUTCOME_SHORT_LABEL } from './coldCallConstants';

const PRIORITY_BADGE_STATUS = { High: 'danger', Medium: 'ongoing', Low: 'cold' };

const formatShortDate = (value) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
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
          <div key={i} className="space-y-3">
            <div className="h-14 skeleton" />
            <div className="h-14 skeleton" />
            <div className="h-14 skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        Failed to connect to backend: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Cold Calls */}
      <button
        type="button"
        onClick={() => onNavigate('cold-calls')}
        className="text-left w-full cursor-pointer group"
      >
        <Card
          title="📞 Cold Calls"
          className="group-hover:border-navy-300 group-hover:shadow-md transition-all"
          actionComponent={<Badge label={coldCalls.length} status="default" />}
        >
          <p className="text-xs text-slate-500 -mt-2 mb-3">Outbound calls to new prospects.</p>
          {coldCalls.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">
              No calls yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {coldCalls.slice(0, 3).map((call) => (
                <div key={call._id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-navy-900 text-sm">{call.prospectName}</span>
                    <Badge label={CALL_OUTCOME_SHORT_LABEL[call.callOutcome] || call.callOutcome} status={call.callOutcome} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">📞 {call.phoneNumber}</p>
                </div>
              ))}
              <p className="text-xs text-navy-700 font-medium pt-1">View all →</p>
            </div>
          )}
        </Card>
      </button>

      {/* Prospecting Leads */}
      <button
        type="button"
        onClick={() => onNavigate('prospecting')}
        className="text-left w-full cursor-pointer group"
      >
        <Card
          title="🎯 Prospecting Leads"
          className="group-hover:border-navy-300 group-hover:shadow-md transition-all"
          actionComponent={<Badge label={prospectingLeads.length} status="default" />}
        >
          <p className="text-xs text-slate-500 -mt-2 mb-3">Leads under active research & outreach.</p>
          {prospectingLeads.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">
              No leads yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {prospectingLeads.slice(0, 3).map((lead) => (
                <div key={lead._id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-navy-900 text-sm">{lead.company}</span>
                    <Badge label={lead.opportunityStage} status={lead.opportunityStage} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{lead.contactPerson}</p>
                </div>
              ))}
              <p className="text-xs text-navy-700 font-medium pt-1">View all →</p>
            </div>
          )}
        </Card>
      </button>

      {/* New Industry */}
      <button
        type="button"
        onClick={() => onNavigate('new-industry')}
        className="text-left w-full cursor-pointer group"
      >
        <Card
          title="🌐 New Industry"
          className="group-hover:border-navy-300 group-hover:shadow-md transition-all"
          actionComponent={<Badge label={newIndustryItems.length} status="default" />}
        >
          <p className="text-xs text-slate-500 -mt-2 mb-3">New vertical / market exploration.</p>
          {newIndustryItems.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">
              No items yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {newIndustryItems.slice(0, 3).map((item) => {
                const followUp = formatShortDate(item.nextFollowUp);
                return (
                  <div key={item._id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-navy-900 text-sm">{item.name}</span>
                      {item.priority && <Badge label={item.priority} status={PRIORITY_BADGE_STATUS[item.priority]} />}
                    </div>
                    {followUp && <p className="text-xs text-slate-600 mt-1">📅 {followUp}</p>}
                  </div>
                );
              })}
              <p className="text-xs text-navy-700 font-medium pt-1">View all →</p>
            </div>
          )}
        </Card>
      </button>
    </div>
  );
};

export default OverviewModule;
