import { createContext, useContext, useState, useEffect } from 'react';
import { bdApi } from '../services/api';

const DashboardContext = createContext();

const SIDEBAR_COLLAPSED_KEY = 'bd-sidebar-collapsed';
const CURRENT_USER_KEY = 'bd-current-user';

export const DashboardProvider = ({ children }) => {
  const [activeModule, setActiveModule] = useState('pipeline');
  // The workspace has no auth layer yet. Until it does, the "active team
  // member" is a locally-stored display name used to attribute uploads,
  // memo authorship and comments. Swapping it is a labelling change, not a
  // privilege change — access levels are advisory, not enforced.
  const [currentUser, setCurrentUserState] = useState(() => {
    try {
      return localStorage.getItem(CURRENT_USER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [serverConnected, setServerConnected] = useState(false);
  const [serverStatusMessage, setServerStatusMessage] = useState('Checking connection...');
  const checkBackendStatus = async () => {
    const health = await bdApi.checkHealth();
    if (health.status === 'ok') {
      setServerConnected(true);
      setServerStatusMessage('Backend Live (MongoDB)');
    } else {
      setServerConnected(false);
      setServerStatusMessage('Backend Offline');
    }
  };

  useEffect(() => {
    const initialCheck = setTimeout(checkBackendStatus, 0);
    const interval = setInterval(checkBackendStatus, 15000);
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, []);

  // Quick Log lives in the app header so an interaction can be filed from any
  // screen — logging has to be reachable in one click or it does not happen.
  // The modal is rendered by AppLayout; `clientDataVersion` lets the Client
  // Relations module know something was logged while it was on screen.
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [clientDataVersion, setClientDataVersion] = useState(0);
  const bumpClientData = () => setClientDataVersion((v) => v + 1);

  const setCurrentUser = (name) => {
    const trimmed = (name || '').trim();
    setCurrentUserState(trimmed);
    try {
      if (trimmed) localStorage.setItem(CURRENT_USER_KEY, trimmed);
      else localStorage.removeItem(CURRENT_USER_KEY);
    } catch {
      // localStorage unavailable — the name just won't persist across reloads
    }
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage unavailable — collapse state just won't persist
      }
      return next;
    });
  };

  return (
    <DashboardContext.Provider
      value={{
        activeModule,
        setActiveModule,
        serverConnected,
        serverStatusMessage,
        checkBackendStatus,
        sidebarCollapsed,
        toggleSidebarCollapsed,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        currentUser,
        setCurrentUser,
        quickLogOpen,
        setQuickLogOpen,
        clientDataVersion,
        bumpClientData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};