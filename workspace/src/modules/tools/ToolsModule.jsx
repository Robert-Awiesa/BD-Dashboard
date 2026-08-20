
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const ToolsModule = () => {
  const tools = [
    { name: 'Apollo', desc: 'Lead enrichment and database' },
    { name: 'Claude', desc: 'AI assistant for drafting copy and strategy' },
    { name: 'Perplexity', desc: 'Market research and web intelligence' },
    { name: 'Dripify', desc: 'LinkedIn automation tool' },
    { name: 'CRM (Development)', desc: 'Core pipeline management system' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Working Tools Launcher</h1>
        <p className="text-sm text-slate-600">Quick-launch shortcuts to core external platforms and applications.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool, idx) => (
          <Card key={idx} title={tool.name}>
            <p className="text-xs text-slate-600 mb-4">{tool.desc}</p>
            <Button variant="secondary" className="w-full text-xs">Launch Tool →</Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ToolsModule;