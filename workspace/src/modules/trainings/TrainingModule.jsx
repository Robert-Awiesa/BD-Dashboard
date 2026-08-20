
import Card from '../../components/common/Card';

const TrainingModule = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Trainings & Certifications</h1>
        <p className="text-sm text-slate-600">Track professional development, internal workshops, and external certifications.</p>
      </div>
      <Card title="Team Certifications Log">
        <p className="text-sm text-slate-600">Internal and external training milestones status board.</p>
      </Card>
    </div>
  );
};

export default TrainingModule;