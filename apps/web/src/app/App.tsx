import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LoadingScreen } from '../components/LoadingScreen';
import { useLabStore } from '../store/lab-store';

const WorkbenchPage = lazy(async () => import('../pages/WorkbenchPage'));
const ResearchPage = lazy(async () => import('../pages/ResearchPage'));
const VisionPage = lazy(async () => import('../pages/VisionPage'));

const SettingsPage = lazy(async () => import('../pages/SettingsPage'));
const NotFoundPage = lazy(async () => import('../pages/NotFoundPage'));

export function App() {
  const initialize = useLabStore((state) => state.initialize);
  const initialized = useLabStore((state) => state.initialized);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!initialized) {
    return <LoadingScreen label="Abriendo espacios locales" />;
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingScreen label="Cargando modulo" compact />}>
        <Routes>
          <Route path="/" element={<WorkbenchPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/vision" element={<VisionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
