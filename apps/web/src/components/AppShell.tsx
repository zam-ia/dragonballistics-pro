import {
  BookOpenCheck,
  Crosshair,
  Download,
  FlaskConical,
  Settings2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_NAME, APP_VERSION, type WorkspaceId } from '@dragonballistics/shared';
import { useLabStore } from '../store/lab-store';
import {
  createExportBundle,
  downloadExportBundle,
  readExportBundle,
} from '../utils/workspace-files';

const navigation = [
  { to: '/', label: 'Laboratorio', icon: Crosshair, end: true },
  { to: '/research', label: 'Investigacion', icon: BookOpenCheck, end: false },
  { to: '/settings', label: 'Ajustes', icon: Settings2, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const workspaces = useLabStore((state) => state.workspaces);
  const activeWorkspaceId = useLabStore((state) => state.activeWorkspaceId);
  const preferences = useLabStore((state) => state.preferences);
  const persistenceError = useLabStore((state) => state.persistenceError);
  const setActiveWorkspace = useLabStore((state) => state.setActiveWorkspace);
  const replaceFromImport = useLabStore((state) => state.replaceFromImport);
  const clearPersistenceError = useLabStore((state) => state.clearPersistenceError);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved =
        preferences.theme === 'system' ? (media.matches ? 'dark' : 'light') : preferences.theme;
      root.dataset.theme = resolved;
      root.dataset.density = preferences.density;
      root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preferences]);

  function handleExport() {
    const bundle = createExportBundle({ activeWorkspaceId, workspaces, preferences });
    downloadExportBundle(bundle);
    setNotice('Exportacion JSON creada.');
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const bundle = await readExportBundle(file);
      await replaceFromImport(bundle);
      setNotice('Cuatro espacios importados y validados.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo importar el archivo.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <FlaskConical size={20} />
          </span>
          <div>
            <strong>{APP_NAME}</strong>
            <span>LABORATORIO 2D</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navegacion principal">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="safety-card">
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <strong>Modo independiente</strong>
            <span>No lee ni controla juegos.</span>
          </div>
        </div>
        <span className="version-label">VERSION {APP_VERSION} · FASE 2</span>
      </aside>

      <section className="app-column">
        <header className="topbar">
          <label className="workspace-select">
            <span>ESPACIO ACTIVO</span>
            <select
              aria-label="Espacio activo"
              value={activeWorkspaceId}
              onChange={(event) => setActiveWorkspace(event.target.value as WorkspaceId)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <div className="topbar-actions">
            <span className="save-state">
              <i aria-hidden="true" /> Guardado local
            </span>
            <button
              type="button"
              className="button ghost"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} aria-hidden="true" /> <span>Importar</span>
            </button>
            <button type="button" className="button ghost" onClick={handleExport}>
              <Download size={16} aria-hidden="true" /> <span>Exportar</span>
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </div>
        </header>

        {persistenceError ? (
          <div className="system-alert" role="alert">
            <span>Persistencia local: {persistenceError}</span>
            <button type="button" onClick={clearPersistenceError}>
              Cerrar
            </button>
          </div>
        ) : null}
        {notice ? (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        ) : null}

        <main className="page-content">{children}</main>
      </section>
    </div>
  );
}
