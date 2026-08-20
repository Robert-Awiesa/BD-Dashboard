
import Card from '../common/Card';

const MetricWidget = ({ title, value, change, isPositive = true, icon }) => {
  return (
    <Card className="hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">{title}</p>
          <h4 className="text-2xl font-bold text-navy-900 mt-1">{value}</h4>
        </div>
        {icon && (
          <div className="p-3 bg-navy-50 rounded-xl text-navy-700 border border-navy-200">
            {icon}
          </div>
        )}
      </div>
      {change && (
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            isPositive ? 'bg-forest-50 text-forest-700' : 'bg-red-50 text-red-700'
          }`}>
            {isPositive ? '+' : ''}{change}%
          </span>
          <span className="text-xs text-slate-600">vs last month</span>
        </div>
      )}
    </Card>
  );
};

export default MetricWidget;