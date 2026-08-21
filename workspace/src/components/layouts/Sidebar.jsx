import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDashboard } from '../../context/hooks/DashboardContext';
import NavIcon from './navIcons';

const NAV_ITEMS = [
  { id: 'pipeline', label: 'Pipeline Tracker' },
  { id: 'tenders', label: 'Tenders & EOI' },
  { id: 'events', label: 'Events & Forums' },
  { id: 'field-visits', label: 'Field Visits' },
  { id: 'tasks', label: 'Tasks & Projects' },
  { id: 'social-media', label: 'Social Media' },
  { id: 'client-relations', label: 'Client Relations' },
  { id: 'partners', label: 'Partners' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'training', label: 'Trainings & Certs' },
  { id: 'reports', label: 'Reports & Docs' },
  { id: 'tools', label: 'Working Tools' },
  { id: 'blog', label: 'Blog & Content' },
];

const CollapseIcon = ({ collapsed }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

// Portal-rendered tooltip so it can escape the scrollable <nav>'s clipping box.
const NavTooltip = ({ anchorRect, label }) => {
  if (!anchorRect) return null;
  return createPortal(
    <span
      className="pointer-events-none fixed px-2.5 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-medium whitespace-nowrap shadow-lg z-50"
      style={{
        top: anchorRect.top + anchorRect.height / 2,
        left: anchorRect.right + 8,
        transform: 'translateY(-50%)',
      }}
    >
      {label}
    </span>,
    document.body
  );
};

const Sidebar = () => {
  const {
    activeModule,
    setActiveModule,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useDashboard();
  const [logoFailed, setLogoFailed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null); // { id, rect }
  const navRefs = useRef({});

  // Close the mobile drawer on Escape for keyboard users.
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const handleNavClick = (id) => {
    setActiveModule(id);
    setMobileSidebarOpen(false);
  };

  const handleNavHover = (id) => {
    if (!sidebarCollapsed) return;
    const el = navRefs.current[id];
    if (el) setHoveredItem({ id, rect: el.getBoundingClientRect() });
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-900/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          bg-white border-r border-slate-200 flex flex-col h-[calc(100vh-4rem)] select-none shrink-0
          transition-[width,transform] duration-200 ease-in-out
          fixed top-16 left-0 z-40
          ${sidebarCollapsed ? 'lg:w-18' : 'lg:w-64'}
          w-64
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2 overflow-hidden">
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
            {logoFailed ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-tr from-navy-700 to-forest-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                  TG
                </div>
                <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-navy-700 truncate">
                    TGTS Africa
                  </h2>
                  <p className="text-sm font-semibold text-navy-900 leading-tight truncate">Workspace Hub</p>
                </div>
              </div>
            ) : (
              <>
                {/* Compact mark shown when collapsed on desktop */}
                <img
                  src="/favicon-mark.png"
                  alt="TGTS Africa"
                  className={`h-8 w-8 object-contain shrink-0 rounded ${sidebarCollapsed ? 'hidden lg:block' : 'hidden'}`}
                  onError={() => setLogoFailed(true)}
                />
                {/* Full logo shown when expanded (and always on mobile, which is never collapsed) */}
                <img
                  src="/logo-sidebar.png"
                  alt="TGTS Africa"
                  className={`h-9 w-auto object-contain shrink-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                  onError={() => setLogoFailed(true)}
                />
              </>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ${sidebarCollapsed ? 'lg:mx-auto' : ''}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon collapsed={sidebarCollapsed} />
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" onMouseLeave={() => setHoveredItem(null)}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => { navRefs.current[item.id] = el; }}
                onClick={() => handleNavClick(item.id)}
                onMouseEnter={() => handleNavHover(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  isActive
                    ? 'bg-navy-50 text-navy-700 border border-navy-200 shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <NavIcon id={item.id} className={`w-[22px] h-[22px] ${isActive ? '' : 'text-slate-400'}`} />
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`p-3 border-t border-slate-200 text-[11px] text-slate-500 text-center ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
          TGTS Africa • BD Workspace v1.0
        </div>
      </aside>

      {sidebarCollapsed && hoveredItem && (
        <NavTooltip
          anchorRect={hoveredItem.rect}
          label={NAV_ITEMS.find((i) => i.id === hoveredItem.id)?.label}
        />
      )}
    </>
  );
};

export default Sidebar;
