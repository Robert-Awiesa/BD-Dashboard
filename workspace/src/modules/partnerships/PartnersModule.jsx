
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const PartnersModule = () => {
  const partners = [
    { name: 'Quibitron', focus: 'Tech Infrastructure & API Sharing', status: 'Active' },
    { name: 'Revnuu', focus: 'Monetization & Lead Attribution', status: 'Collaborating' },
    { name: 'Orane', focus: 'Enterprise Resource Consulting', status: 'In Review' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Partners Workspace</h1>
          <p className="text-sm text-slate-600">Collaborative initiatives with key ecosystem channels.</p>
        </div>
        <Button variant="primary">+ Register Partner</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {partners.map((partner, index) => (
          <Card key={index} title={partner.name}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{partner.focus}</p>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-600">Status</span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-navy-50 text-navy-700">
                  {partner.status}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PartnersModule;