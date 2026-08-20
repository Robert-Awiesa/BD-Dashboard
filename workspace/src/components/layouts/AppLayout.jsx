import Header from './Header';
import Sidebar from './Sidebar';
import LogInteractionModal from '../../modules/client-relationships/LogInteractionModal';
import { useDashboard } from '../../context/hooks/DashboardContext';

const AppLayout = ({ children }) => {
  const { sidebarCollapsed, quickLogOpen, setQuickLogOpen } = useDashboard();

  return (
    <div className="min-h-screen bg-slate-50 text-navy-900 flex flex-col font-sans">
      <Header onQuickAdd={() => setQuickLogOpen(true)} />

      {/* Rendered at layout level so a client interaction can be logged from
          any module — the whole point of the header Quick Log. Mounted only
          while open so it starts from a clean form each time. */}
      {quickLogOpen && (
        <LogInteractionModal open onClose={() => setQuickLogOpen(false)} />
      )}

      <Sidebar />
      <main
        className={`flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto relative z-0 transition-[margin] duration-200 ease-in-out ${
          sidebarCollapsed ? 'lg:ml-18' : 'lg:ml-64'
        }`}
      >
        <img
          src="/logo-watermark.png"
          alt=""
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54vw] max-w-[880px] min-w-[420px] opacity-[0.16] pointer-events-none select-none -z-10"
        />
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;