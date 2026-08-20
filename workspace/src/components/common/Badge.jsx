
const statusStyles = {
  active: 'bg-navy-50 text-navy-700 border-navy-200',
  ongoing: 'bg-amber-50 text-amber-700 border-amber-200',
  success: 'bg-forest-50 text-forest-700 border-forest-200',
  cold: 'bg-slate-100 text-slate-600 border-slate-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  default: 'bg-slate-100 text-slate-600 border-slate-200',
  // Opportunity Stage badge colors for the Prospecting Leads pipeline
  Unqualified: 'bg-slate-100 text-slate-600 border-slate-200',
  Qualified: 'bg-sky-50 text-sky-700 border-sky-200',
  'Follow-Up': 'bg-amber-50 text-amber-700 border-amber-200',
  Demo: 'bg-violet-50 text-violet-700 border-violet-200',
  Cold: 'bg-slate-100 text-slate-500 border-slate-200',
  Negotiation: 'bg-orange-50 text-orange-700 border-orange-200',
  Won: 'bg-forest-50 text-forest-700 border-forest-200',
  Lost: 'bg-red-50 text-red-700 border-red-200',
  // Call Outcome badge colors for the Cold Calls log
  'Connected - Interested': 'bg-forest-50 text-forest-700 border-forest-200',
  'Connected - Not Interested': 'bg-slate-100 text-slate-600 border-slate-200',
  'Voicemail Left': 'bg-amber-50 text-amber-700 border-amber-200',
  'Gatekeeper / Decision Maker Unavailable': 'bg-orange-50 text-orange-700 border-orange-200',
  'Wrong Number / Invalid Contact': 'bg-red-50 text-red-700 border-red-200',
};

const Badge = ({ label, status = 'default' }) => {
  const styles = statusStyles[status] || statusStyles.default;
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${styles}`}>
      {label}
    </span>
  );
};

export default Badge;