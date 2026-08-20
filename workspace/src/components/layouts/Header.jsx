import Button from '../common/Button';
import { useDashboard } from '../../context/hooks/DashboardContext';

const Header = ({ onQuickAdd }) => {
  const { serverConnected, serverStatusMessage, mobileSidebarOpen, setMobileSidebarOpen } = useDashboard();

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0 lg:w-1/3 lg:flex-none">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-navy-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          aria-label={mobileSidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileSidebarOpen}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileSidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className="relative w-full hidden sm:block">
          <input
            type="text"
            placeholder="Search pipelines, tenders, partners..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all placeholder:text-slate-500"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50">
          <span className={`w-2 h-2 rounded-full shrink-0 ${serverConnected ? 'bg-forest-600 animate-pulse shadow-[0_0_8px_rgba(31,110,68,0.5)]' : 'bg-red-600'}`}></span>
          <span className={`hidden sm:inline ${serverConnected ? 'text-forest-700' : 'text-red-700'}`}>
            {serverStatusMessage}
          </span>
        </div>
        <Button variant="primary" onClick={onQuickAdd} className="text-xs py-1.5 px-2.5 sm:px-3 font-semibold shadow-navy-900/10 shadow-lg whitespace-nowrap">
          <span className="hidden sm:inline">+ Quick Log</span>
          <span className="sm:hidden">+ Log</span>
        </Button>
      </div>
    </header>
  );
};

export default Header;