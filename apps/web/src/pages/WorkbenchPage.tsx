import {
  simulateProjectile,
  vectorBetween,
  type SimulationResult,
  type SolverCandidate,
} from '@dragonballistics/physics';
import type { SimulationControls, Vec2 } from '@dragonballistics/shared';
import { Activity, Clock3, Gauge, Info, Mountain, Orbit, Wind } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GeometryCanvas } from '../features/workbench/GeometryCanvas';
import { InverseSolverPanel } from '../features/workbench/InverseSolverPanel';
import { isConfirmedHit } from '../features/workbench/inverse-solver-model';
import {
  buildSimulationInput,
  solverScenarioSignature,
} from '../features/workbench/simulation-input';
import { useLabStore } from '../store/lab-store';

export default function WorkbenchPage() {
  const activeWorkspaceId = useLabStore((state) => state.activeWorkspaceId);
  const workspaces = useLabStore((state) => state.workspaces);
  const preferences = useLabStore((state) => state.preferences);
  const updateActivePoint = useLabStore((state) => state.updateActivePoint);
  const updateActiveSimulation = useLabStore((state) => state.updateActiveSimulation);
  const renameActiveWorkspace = useLabStore((state) => state.renameActiveWorkspace);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? workspaces[0];

  if (!workspace) {
    throw new Error('No existe un espacio de trabajo valido.');
  }

  const primaryInput = useMemo(
    () => buildSimulationInput(workspace.launch, workspace.target, workspace.simulation),
    [workspace],
  );
  const primaryResult = useMemo(() => simulateProjectile(primaryInput), [primaryInput]);
  const scenarioSignature = useMemo(() => solverScenarioSignature(primaryInput), [primaryInput]);
  const [inversePreview, setInversePreview] = useState<{
    workspaceId: string;
    signature: string;
    candidate: SolverCandidate;
    comparison: SolverCandidate | null;
  } | null>(null);
  const currentPreview =
    inversePreview?.workspaceId === workspace.id && inversePreview.signature === scenarioSignature
      ? inversePreview
      : null;
  const inverseResult = useMemo(
    () =>
      currentPreview
        ? simulateProjectile({
            ...primaryInput,
            launchAngleDegrees: currentPreview.candidate.angleDegrees,
            power: currentPreview.candidate.power,
          })
        : null,
    [currentPreview, primaryInput],
  );
  const inverseComparisonResult = useMemo(
    () =>
      currentPreview?.comparison
        ? simulateProjectile({
            ...primaryInput,
            launchAngleDegrees: currentPreview.comparison.angleDegrees,
            power: currentPreview.comparison.power,
          })
        : null,
    [currentPreview, primaryInput],
  );
  const targetId = primaryInput.collisions.targets[0]?.id ?? '';
  const targetRadius = primaryInput.collisions.targets[0]?.radius ?? 0;
  function applyVerified(candidate: SolverCandidate) {
    if (!currentPreview || !isConfirmedHit(candidate, targetId)) return;
    const checked = simulateProjectile({
      ...primaryInput,
      launchAngleDegrees: candidate.angleDegrees,
      power: candidate.power,
    });
    if (
      checked.terminationReason !== 'target-impact' ||
      checked.impact?.kind !== 'target' ||
      checked.impact.targetId !== targetId
    )
      return;
    updateActiveSimulation({ angleDegrees: candidate.angleDegrees, power: candidate.power });
  }
  const comparisonInput = useMemo(() => {
    if (!workspace.simulation.comparison.enabled) return null;
    return buildSimulationInput(workspace.launch, workspace.target, {
      ...workspace.simulation,
      angleDegrees: workspace.simulation.comparison.angleDegrees,
      power: workspace.simulation.comparison.power,
    });
  }, [workspace]);
  const comparisonResult = useMemo(
    () => (comparisonInput ? simulateProjectile(comparisonInput) : null),
    [comparisonInput],
  );
  const delta = vectorBetween(workspace.launch, workspace.target);

  return (
    <div className="workbench-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">FASE 2 · MOTOR FISICO</p>
          <h1>Simulador balistico 2D</h1>
          <p>
            Simulacion determinista en unidades del mundo. Potencia se transforma linealmente a
            velocidad; no representa constantes verificadas de DragonBound.
          </p>
        </div>
        <div className="phase-badge">
          <Activity size={17} aria-hidden="true" />
          <span>
            <strong>Motor fisico activo</strong>
            {terminationLabel(primaryResult)}
          </span>
        </div>
      </header>

      <section className="metric-strip" aria-label="Resultados de simulacion">
        <Metric
          icon={Gauge}
          label="VELOCIDAD INICIAL"
          value={`${format(primaryResult.parametersUsed.initialSpeed)} u/s`}
        />
        <Metric
          icon={Clock3}
          label="TIEMPO DE VUELO"
          value={`${primaryResult.flightTimeSeconds.toFixed(3)} s`}
        />
        <Metric
          icon={Orbit}
          label="ALCANCE HORIZONTAL"
          value={`${primaryResult.horizontalRange.toFixed(2)} u`}
        />
        <Metric
          icon={Mountain}
          label="ALTURA MAXIMA"
          value={`${primaryResult.maximumHeight.toFixed(2)} u`}
        />
      </section>

      <section className="workbench-grid physics-layout">
        <aside className="control-panel panel physics-controls-panel">
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
          <PhysicsControls controls={workspace.simulation} onChange={updateActiveSimulation} />
          <ResultMessages result={primaryResult} />
          <div className="boundary-note">
            <Info size={16} aria-hidden="true" />
            <p>
              Modelo independiente: sin captura, lectura de procesos, control del juego ni
              constantes comerciales no verificadas.
            </p>
          </div>
        </aside>

        <section className="canvas-panel panel physics-canvas-panel">
          <div className="panel-heading">
            <div>
              <span>TRAYECTORIA CALCULADA</span>
              <strong>
                {workspace.simulation.integrator === 'rk4' ? 'Runge-Kutta 4' : 'Euler semimplicito'}{' '}
                · paso {workspace.simulation.timeStepSeconds.toFixed(3)} s
              </strong>
            </div>
            <div className="canvas-legend" aria-label="Leyenda de trayectorias">
              <span className="primary-line">PRINCIPAL</span>
              {comparisonResult ? <span className="comparison-line">COMPARACION</span> : null}
              {currentPreview ? <span className="inverse-line">INVERSA</span> : null}
              {inverseComparisonResult ? (
                <span className="inverse-high-line">ARCO ALTO</span>
              ) : null}
              <span className="coordinate-readout">
                ΔX {delta.x.toFixed(1)} · ΔY {delta.y.toFixed(1)}
              </span>
            </div>
          </div>
          <GeometryCanvas
            launch={workspace.launch}
            target={workspace.target}
            showGrid={preferences.showGrid}
            primaryPath={primaryResult.trajectory.map((point) => point.position)}
            comparisonPath={comparisonResult?.trajectory.map((point) => point.position) ?? []}
            primaryImpact={primaryResult.impact?.point ?? null}
            comparisonImpact={comparisonResult?.impact?.point ?? null}
            primaryApex={primaryResult.apexPoint.position}
            comparisonApex={comparisonResult?.apexPoint.position ?? null}
            targetRadius={targetRadius}
            inversePath={inverseResult?.trajectory.map((point) => point.position) ?? []}
            inverseImpact={
              inverseResult?.impact?.point ??
              currentPreview?.candidate.closestApproach?.point ??
              null
            }
            inverseApex={inverseResult?.apexPoint.position ?? null}
            inverseComparisonPath={
              inverseComparisonResult?.trajectory.map((point) => point.position) ?? []
            }
            inverseComparisonImpact={
              inverseComparisonResult?.impact?.point ??
              currentPreview?.comparison?.closestApproach?.point ??
              null
            }
            inverseComparisonApex={inverseComparisonResult?.apexPoint.position ?? null}
            onPointChange={updateActivePoint}
          />
          <footer className="simulation-footer">
            <span>
              ESTADO <strong>{primaryResult.status.toUpperCase()}</strong>
            </span>
            <span>
              FIN <strong>{primaryResult.terminationReason}</strong>
            </span>
            <span>
              PASOS <strong>{primaryResult.iterations}</strong>
            </span>
            <span>
              IMPACTO{' '}
              <strong>
                {primaryResult.impact
                  ? `${primaryResult.impact.point.x.toFixed(2)}, ${primaryResult.impact.point.y.toFixed(2)}`
                  : '—'}
              </strong>
            </span>
          </footer>
        </section>
      </section>
      {currentPreview ? (
        <p className="solver-preview-caption" role="status">
          Trayectoria inversa seleccionada: {currentPreview.candidate.angleDegrees.toFixed(2)}° ·
          potencia {currentPreview.candidate.power.toFixed(2)} u.
          {inverseComparisonResult ? ' Comparación de arcos superpuesta.' : ''}
        </p>
      ) : null}
      <InverseSolverPanel
        key={workspace.id + ':' + scenarioSignature}
        simulation={primaryInput}
        previewVisible={currentPreview !== null}
        onPreview={(candidate, comparison) =>
          setInversePreview(
            candidate
              ? {
                  workspaceId: workspace.id,
                  signature: scenarioSignature,
                  candidate,
                  comparison: comparison ?? null,
                }
              : null,
          )
        }
        onApply={applyVerified}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
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
        <NumericInput
          label="X / UNIDADES"
          ariaLabel={`${title} X`}
          value={point.x}
          minimum={0}
          maximum={800}
          step={0.1}
          onChange={(value) => update('x', String(value))}
        />
        <NumericInput
          label="Y / UNIDADES"
          ariaLabel={`${title} Y`}
          value={point.y}
          minimum={0}
          maximum={400}
          step={0.1}
          onChange={(value) => update('y', String(value))}
        />
      </div>
    </fieldset>
  );
}

function PhysicsControls({
  controls,
  onChange,
}: {
  controls: SimulationControls;
  onChange: (patch: Partial<SimulationControls>) => void;
}) {
  return (
    <section className="physics-controls" aria-labelledby="physics-controls-title">
      <div className="control-section-title" id="physics-controls-title">
        <Activity size={14} aria-hidden="true" /> PARAMETROS FISICOS
      </div>
      <div className="coordinate-fields">
        <NumericInput
          label="ANGULO / DEG"
          ariaLabel="Angulo de lanzamiento"
          value={controls.angleDegrees}
          minimum={-180}
          maximum={180}
          step={0.1}
          onChange={(angleDegrees) => onChange({ angleDegrees })}
        />
        <NumericInput
          label="POTENCIA / U"
          ariaLabel="Potencia"
          value={controls.power}
          minimum={0}
          maximum={120}
          step={0.1}
          onChange={(power) => onChange({ power })}
        />
        <NumericInput
          label="GRAVEDAD / U·S⁻²"
          ariaLabel="Gravedad"
          value={controls.gravity}
          minimum={0}
          maximum={50}
          step={0.01}
          onChange={(gravity) => onChange({ gravity })}
        />
        <NumericInput
          label="PASO / SEGUNDOS"
          ariaLabel="Paso temporal"
          value={controls.timeStepSeconds}
          minimum={0.001}
          maximum={0.2}
          step={0.001}
          onChange={(timeStepSeconds) => onChange({ timeStepSeconds })}
        />
      </div>
      <label className="field-group">
        <span>INTEGRADOR</span>
        <select
          aria-label="Integrador"
          value={controls.integrator}
          onChange={(event) =>
            onChange({ integrator: event.target.value as SimulationControls['integrator'] })
          }
        >
          <option value="rk4">Runge-Kutta 4</option>
          <option value="semi-implicit-euler">Euler semimplicito</option>
        </select>
      </label>

      <div className="control-section-title">
        <Wind size={14} aria-hidden="true" /> VIENTO
      </div>
      <label className="field-group">
        <span>MODELO DE VIENTO</span>
        <select
          aria-label="Modelo de viento"
          value={controls.windModel}
          onChange={(event) =>
            onChange({ windModel: event.target.value as SimulationControls['windModel'] })
          }
        >
          <option value="acceleration">Aceleracion directa</option>
          <option value="linear-drag">Velocidad de aire + arrastre lineal</option>
        </select>
      </label>
      <div className="coordinate-fields">
        <NumericInput
          label={controls.windModel === 'acceleration' ? 'MAGNITUD / U·S⁻²' : 'MAGNITUD / U·S⁻¹'}
          ariaLabel="Magnitud del viento"
          value={controls.windMagnitude}
          minimum={0}
          maximum={50}
          step={0.1}
          onChange={(windMagnitude) => onChange({ windMagnitude })}
        />
        <NumericInput
          label="DIRECCION / DEG"
          ariaLabel="Direccion del viento"
          value={controls.windDirectionDegrees}
          step={1}
          onChange={(windDirectionDegrees) => onChange({ windDirectionDegrees })}
        />
      </div>
      {controls.windModel === 'linear-drag' ? (
        <NumericInput
          label="COEFICIENTE DE ARRASTRE / S⁻¹"
          ariaLabel="Coeficiente de arrastre"
          value={controls.dragCoefficientPerSecond}
          minimum={0}
          maximum={5}
          step={0.01}
          onChange={(dragCoefficientPerSecond) => onChange({ dragCoefficientPerSecond })}
        />
      ) : null}

      <div className="comparison-controls">
        <label className="comparison-toggle">
          <input
            type="checkbox"
            checked={controls.comparison.enabled}
            onChange={(event) =>
              onChange({ comparison: { ...controls.comparison, enabled: event.target.checked } })
            }
          />
          <span>Comparar segunda simulacion</span>
        </label>
        {controls.comparison.enabled ? (
          <div className="coordinate-fields">
            <NumericInput
              label="ANGULO B / DEG"
              ariaLabel="Angulo de comparacion"
              value={controls.comparison.angleDegrees}
              minimum={-180}
              maximum={180}
              step={0.1}
              onChange={(angleDegrees) =>
                onChange({ comparison: { ...controls.comparison, angleDegrees } })
              }
            />
            <NumericInput
              label="POTENCIA B / U"
              ariaLabel="Potencia de comparacion"
              value={controls.comparison.power}
              minimum={0}
              maximum={120}
              step={0.1}
              onChange={(power) => onChange({ comparison: { ...controls.comparison, power } })}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NumericInput({
  label,
  ariaLabel,
  value,
  minimum,
  maximum,
  step,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  minimum?: number;
  maximum?: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="numeric-field">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="number"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </label>
  );
}

function ResultMessages({ result }: { result: SimulationResult }) {
  const messages = [...result.errors, ...result.warnings];
  if (messages.length === 0) return null;
  return (
    <div className={result.errors.length > 0 ? 'result-messages error' : 'result-messages'}>
      {messages.map((message) => (
        <p key={`${message.code}:${message.message}`}>{message.message}</p>
      ))}
    </div>
  );
}

function terminationLabel(result: SimulationResult): string {
  const labels: Record<SimulationResult['terminationReason'], string> = {
    'ground-impact': 'Impacto con suelo',
    'terrain-impact': 'Impacto con terreno',
    'target-impact': 'Impacto con objetivo',
    'out-of-bounds': 'Salida del mundo',
    'maximum-time': 'Tiempo maximo',
    'maximum-iterations': 'Limite de iteraciones',
    'invalid-numeric-state': 'Estado numerico invalido',
    'invalid-input': 'Parametros invalidos',
  };
  return labels[result.terminationReason];
}

function format(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}
