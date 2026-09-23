import { useEffect } from 'react';
import { AppStateProvider, useApp } from './state/AppState';
import { ToastProvider } from './components/ui';
import { useRoute } from './lib/router';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TranslatePage } from './pages/TranslatePage';
import { ImagesPage } from './pages/ImagesPage';
import { WritePage } from './pages/WritePage';
import { AgentPage } from './pages/AgentPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AssetsPage } from './pages/AssetsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function Router() {
  const route = useRoute();
  const { config, ready } = useApp();
  const [first] = route.segments;

  useEffect(() => {
    document.documentElement.dataset.theme = config?.theme ?? 'dark';
    document.documentElement.lang = config?.language ?? 'id';
    if (config?.accent) {
      document.documentElement.style.setProperty('--accent', config.accent);
    }
  }, [config?.theme, config?.language, config?.accent]);

  if (!ready) {
    return (
      <div className="center" style={{ height: '100vh', flexDirection: 'column', gap: 14 }}>
        <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 22 }}>K</div>
        <div className="spinner" />
        <div className="card-sub">Menghubungkan ke runtime lokal…</div>
      </div>
    );
  }

  switch (first) {
    case undefined:
      return <HomePage />;
    case 'studio':
      return <StudioPage />;
    case 'projects':
      return route.segments[1] ? <ProjectDetailPage projectId={route.segments[1]} /> : <ProjectsPage />;
    case 'translate':
      return <TranslatePage />;
    case 'images':
      return <ImagesPage />;
    case 'write':
      return <WritePage />;
    case 'agent':
      return <AgentPage />;
    case 'approvals':
      return <ApprovalsPage />;
    case 'assets':
      return <AssetsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <NotFoundPage />;
  }
}

export function App() {
  return (
    <AppStateProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AppStateProvider>
  );
}
