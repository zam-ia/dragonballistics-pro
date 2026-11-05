import {
  directionDegrees,
  euclideanDistance,
  horizontalDistance,
  vectorBetween,
} from '@dragonballistics/physics';
import type { Vec2 } from '@dragonballistics/shared';
import { CheckCircle2, Info, Move3d, Ruler, Target } from 'lucide-react';
import { useState } from 'react';
import { GeometryCanvas } from '../features/workbench/GeometryCanvas';
import { useLabStore } from '../store/lab-store';

export default function WorkbenchPage() {
  const activeWorkspaceId = useLabStore((state) => state.activeWorkspaceId);
  const workspaces = useLabStore((state) => state.workspaces);
  const preferences = useLabStore((state) => state.preferences);
  const updateActivePoint = useLabStore((state) => state.updateActivePoint);
  const renameActiveWorkspace = useLabStore((state) => state.renameActiveWorkspace);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? workspaces[0];

  if (!workspace) {
    throw new Error('No existe un espacio de trabajo valido.');
  }

  const delta = vectorBetween(workspace.launch, workspace.target);
  const distance = euclideanDistance(workspace.launch, workspace.target);
  const direction = directionDegrees(workspace.launch, workspace.target);

  return (
    <div className="workbench-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">FASE 1 · BASE OPERATIVA</p>
          <h1>Laboratorio de geometria</h1>
          <p>
            Define lanzamiento y objetivo en unidades del mundo. Esta fase mide geometria real; el
            motor balistico comienza en la Fase 2.
          </p>
        </div>
        <div className="phase-badge">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>
            <strong>Geometria validada</strong>
            Motor fisico pendiente
          </span>
        </div>
      </header>

      <section className="metric-strip" aria-label="Mediciones geometricas">
        <Metric icon={Ruler} label="DISTANCIA VECTORIAL" value={`${distance.toFixed(2)} u`} />
        <Metric
          icon={Move3d}
          label="DISTANCIA HORIZONTAL"
          value={`${horizontalDistance(workspace.launch, workspace.target).toFixed(2)} u`}
        />
        <Metric icon={Target} label="DIFERENCIA DE ALTURA" value={`${delta.y.toFixed(2)} u`} />
        <Metric icon={Info} label="DIRECCION GEOMETRICA" value={`${direction.toFixed(2)} deg`} />
      </section>

      <section className="workbench-grid">
        <aside className="control-panel panel">
          <WorkspaceNameEditor
            key={`${workspace.id}:${workspace.name}`}
            name={workspace.name}
            onSave={renameActiveWorkspace}
          />
          <PointEditor
            title="Punto de lanzamiento"
            accent="teal"
            point={workspace.launch}
            onChange={(point) => updateActivePoint('launch', point)}
          />
          <PointEditor
            title="Punto objetivo"
            accent="amber"
            point={workspace.target}
            onChange={(point) => updateActivePoint('target', point)}
          />
          <div className="boundary-note">
            <Info size={16} aria-hidden="true" />
            <p>
              Sin captura de pantalla, lectura de procesos, control del juego ni constantes no
              verificadas.
            </p>
          </div>
        </aside>

        <section className="canvas-panel panel">
          <div className="panel-heading">
            <div>
              <span>PLANO DEL ESCENARIO</span>
              <strong>Ejes del mundo · Y positivo hacia arriba</strong>
            </div>
            <span className="coordinate-readout">
              ΔX {delta.x.toFixed(1)} · ΔY {delta.y.toFixed(1)}
            </span>
          </div>
          <GeometryCanvas
            launch={workspace.launch}
            target={workspace.target}
            showGrid={preferences.showGrid}
            onPointChange={updateActivePoint}
          />
        </section>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WorkspaceNameEditor({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    else setDraft(name);
  }

  return (
    <label className="field-group workspace-name-field">
      <span>NOMBRE DEL ESPACIO</span>
      <input
        value={draft}
        maxLength={48}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function PointEditor({
  title,
  accent,
  point,
  onChange,
}: {
  title: string;
  accent: 'teal' | 'amber';
  point: Vec2;
  onChange: (point: Vec2) => void;
}) {
  function update(axis: 'x' | 'y', raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const maximum = axis === 'x' ? 800 : 400;
    onChange({ ...point, [axis]: Math.min(maximum, Math.max(0, parsed)) });
  }

  return (
    <fieldset className={`point-editor ${accent}`}>
      <legend>
        <i aria-hidden="true" /> {title}
      </legend>
      <div className="coordinate-fields">
        <label>
          <span>X / UNIDADES</span>
          <input
            aria-label={`${title} X`}
            type="number"
            min="0"
            max="800"
            step="0.1"
            value={point.x}
            onChange={(event) => update('x', event.target.value)}
          />
        </label>
        <label>
          <span>Y / UNIDADES</span>
          <input
            aria-label={`${title} Y`}
            type="number"
            min="0"
            max="400"
            step="0.1"
            value={point.y}
            onChange={(event) => update('y', event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
