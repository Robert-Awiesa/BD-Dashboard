
import Card from '../common/Card';

const ProgressWidget = ({ title, current, total, unit = 'items' }) => {
  const percentage = Math.round((current / total) * 100) || 0;

  return (
    <Card title={title}>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 font-medium">Progress Overview</span>
          <span className="text-navy-700 font-bold">{current} / {total} {unit}</span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-navy-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
          <span>Completion Rate</span>
          <span className="font-semibold text-slate-700">{percentage}%</span>
        </div>
      </div>
    </Card>
  );
};

export default ProgressWidget;