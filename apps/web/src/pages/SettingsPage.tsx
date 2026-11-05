import { Grid3X3, MonitorCog, MoonStar, PanelLeftClose } from 'lucide-react';
import { useLabStore } from '../store/lab-store';

export default function SettingsPage() {
  const preferences = useLabStore((state) => state.preferences);
  const updatePreferences = useLabStore((state) => state.updatePreferences);

  return (
    <div className="settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PREFERENCIAS LOCALES</p>
          <h1>Ajustes de interfaz</h1>
          <p>Los cambios se aplican al instante y se guardan en este navegador.</p>
        </div>
      </header>

      <section className="settings-grid">
        <article className="setting-card panel">
          <MoonStar size={21} aria-hidden="true" />
          <div>
            <label htmlFor="theme">Tema visual</label>
            <p>Selecciona un tema fijo o sigue la preferencia de Windows.</p>
          </div>
          <select
            id="theme"
            value={preferences.theme}
            onChange={(event) =>
              updatePreferences({ theme: event.target.value as 'dark' | 'light' | 'system' })
            }
          >
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
            <option value="system">Sistema</option>
          </select>
        </article>

        <article className="setting-card panel">
          <PanelLeftClose size={21} aria-hidden="true" />
          <div>
            <label htmlFor="density">Densidad</label>
            <p>Ajusta el espacio entre controles sin ocultar informacion.</p>
          </div>
          <select
            id="density"
            value={preferences.density}
            onChange={(event) =>
              updatePreferences({ density: event.target.value as 'comfortable' | 'compact' })
            }
          >
            <option value="comfortable">Comoda</option>
            <option value="compact">Compacta</option>
          </select>
        </article>

        <ToggleSetting
          icon={Grid3X3}
          title="Cuadricula del plano"
          description="Muestra divisiones de 50 unidades en el laboratorio."
          checked={preferences.showGrid}
          onChange={(showGrid) => updatePreferences({ showGrid })}
        />

        <ToggleSetting
          icon={MonitorCog}
          title="Reducir movimiento"
          description="Desactiva transiciones no esenciales."
          checked={preferences.reducedMotion}
          onChange={(reducedMotion) => updatePreferences({ reducedMotion })}
        />
      </section>
    </div>
  );
}

function ToggleSetting({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Grid3X3;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <article className="setting-card panel">
      <Icon size={21} aria-hidden="true" />
      <div>
        <span className="setting-title">{title}</span>
        <p>{description}</p>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
        <b className="visually-hidden">{title}</b>
      </label>
    </article>
  );
}
