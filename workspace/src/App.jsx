import { DashboardProvider } from './context/hooks/DashboardContext';
import AppLayout from './components/layouts/AppLayout';
import ModuleRouter from './components/layouts/ModuleRouter';

function App() {
  return (
    <DashboardProvider>
      <AppLayout>
        <ModuleRouter />
      </AppLayout>
    </DashboardProvider>
  );
}

export default App;
