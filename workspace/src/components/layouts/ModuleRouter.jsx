import { useDashboard } from '../../context/hooks/useDashboard';
import PipelineModule from '../../modules/pipeline/PipelineModule';
import TendersModule from '../../modules/tenders/TendersModule';
import EventsModule from '../../modules/events/EventsModule';
import FieldVisitsModule from '../../modules/field-visit/FieldVisitsModule';
import TasksModule from '../../modules/tasks/TasksModule';
import SocialMediaModule from '../../modules/social-media/SocialMediaModule';
import ClientRelationsModule from '../../modules/client-relationships/ClientRelationsModule';
import PartnersModule from '../../modules/partnerships/PartnersModule';
import ProposalsModule from '../../modules/proposals/ProposalsModule';
import TrainingModule from '../../modules/trainings/TrainingModule';
import ReportsModule from '../../modules/reports/ReportsModule';
import ToolsModule from '../../modules/tools/ToolsModule';
import BlogModule from '../../modules/blogs/BlogModule';

const ModuleRouter = () => {
  const { activeModule } = useDashboard();

  const renderModule = () => {
    switch (activeModule) {
      case 'pipeline':
        return <PipelineModule />;
      case 'tenders':
        return <TendersModule />;
      case 'events':
        return <EventsModule />;
      case 'field-visits':
        return <FieldVisitsModule />;
      case 'tasks':
        return <TasksModule />;
      case 'social-media':
        return <SocialMediaModule />;
      case 'client-relations':
        return <ClientRelationsModule />;
      case 'partners':
        return <PartnersModule />;
      case 'proposals':
        return <ProposalsModule />;
      case 'training':
        return <TrainingModule />;
      case 'reports':
        return <ReportsModule />;
      case 'tools':
        return <ToolsModule />;
      case 'blog':
        return <BlogModule />;
      default:
        return (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
            <h3 className="text-lg font-medium text-navy-800">Module Not Found</h3>
            <p className="text-sm text-slate-600 mt-1">Selected module "{activeModule}" is not registered.</p>
          </div>
        );
    }
  };

  return (
    <div key={activeModule} className="module-enter">
      {renderModule()}
    </div>
  );
};

export default ModuleRouter;
