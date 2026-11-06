import {
  DEFAULT_SOLVER_BUDGETS,
  SOLVER_HARD_LIMITS,
  type SimulationInput,
  type SolverCandidate,
  type SolverInput,
  type SolverResult,
} from '@dragonballistics/physics';
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Crosshair,
  EyeOff,
  Layers3,
  Play,
  RotateCcw,
  Target,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createSolverWorkerController } from '../../workers/solver-worker-controller';
import './inverse-solver.css';

type FormKey =
  | 'targetId'
  | 'angleMin'
  | 'angleMax'
  | 'powerMin'
  | 'powerMax'
  | 'solutions'
  | 'evaluations'
  | 'timeMs';
type SearchForm = Record<FormKey, string>;

export function initialSearchForm(simulation: SimulationInput): SearchForm {
  return {
    targetId: simulation.collisions.targets[0]?.id ?? '',
    angleMin: '0',
    angleMax: '90',
    powerMin: String(simulation.powerModel.minimumPower),
    powerMax: String(simulation.powerModel.maximumPower),
    solutions: '4',
    evaluations: '320',
    timeMs: String(DEFAULT_SOLVER_BUDGETS.maximumWallTimeMs),
  };
}
function numberOf(raw: string): number {
  return raw.trim().length > 0 ? Number(raw) : Number.NaN;
}
export function validateSolverForm(
  form: SearchForm,
  simulation: SimulationInput,
): { input: SolverInput | null; error: string | null } {
  const a = numberOf(form.angleMin),
    b = numberOf(form.angleMax);
  const p = numberOf(form.powerMin),
    q = numberOf(form.powerMax);
  const n = numberOf(form.solutions),
    e = numberOf(form.evaluations),
    t = numberOf(form.timeMs);
  if (![a, b, p, q, n, e, t].every(Number.isFinite))
    return { input: null, error: 'Todos los campos deben contener números finitos.' };
  if (!simulation.collisions.targets.some((target) => target.id === form.targetId))
    return { input: null, error: 'Selecciona un objetivo existente.' };
  if (a < -360 || b > 360 || a > b)
    return { input: null, error: 'Rango angular inválido: -360° a 360°, mínimo ≤ máximo.' };
  if (p < simulation.powerModel.minimumPower || q > simulation.powerModel.maximumPower || p > q)
    return { input: null, error: 'Rango de potencia fuera del modelo físico o invertido.' };
  if (!Number.isInteger(n) || n < 1 || n > SOLVER_HARD_LIMITS.requestedSolutions)
    return { input: null, error: 'Solicita entre 1 y 16 soluciones.' };
  if (!Number.isInteger(e) || e < 1 || e > SOLVER_HARD_LIMITS.maximumEvaluations)
    return { input: null, error: 'Presupuesto válido: 1 a 4096 evaluaciones.' };
  if (t <= 0 || t > SOLVER_HARD_LIMITS.maximumWallTimeMs)
    return { input: null, error: 'Tiempo permitido: mayor que 0 y hasta 5000 ms.' };
  return {
    error: null,
    input: {
      simulation,
      targetId: form.targetId,
      angleRange: { minimum: a, maximum: b },
      powerRange: { minimum: p, maximum: q },
      requestedSolutions: n,
      budgets: {
        maximumEvaluations: e,
        maximumWallTimeMs: t,
        coarseFraction: DEFAULT_SOLVER_BUDGETS.coarseFraction,
        refinementRounds: DEFAULT_SOLVER_BUDGETS.refinementRounds,
      },
    },
  };
}

export function isConfirmedHit(candidate: SolverCandidate, targetId: string): boolean {
  return (
    candidate.hit === true &&
    candidate.verifiedWithFullSimulation === true &&
    candidate.terminationReason === 'target-impact' &&
    candidate.impact?.kind === 'target' &&
    candidate.impact.targetId === targetId
  );
}

export function solverResultStatus(result: SolverResult | null): string {
  if (!result) return 'Preparado para buscar';
  switch (result.status) {
    case 'succeeded':
      return 'Impactos físicos encontrados';
    case 'no-solution':
      return 'Ningún impacto observado en la búsqueda finita';
    case 'invalid-input':
      return 'Entrada no válida';
    case 'budget-exhausted':
      return 'Presupuesto agotado; candidatos parciales';
    case 'cancelled':
      return 'Búsqueda cancelada';
  }
}
interface Props {
  simulation: SimulationInput;
  previewVisible: boolean;
  onPreview: (candidate: SolverCandidate | null, comparison?: SolverCandidate | null) => void;
  onApply: (candidate: SolverCandidate) => void;
}
const fields: ReadonlyArray<{ key: FormKey; label: string; step: string }> = [
  { key: 'angleMin', label: 'Ángulo mínimo (°)', step: '0.1' },
  { key: 'angleMax', label: 'Ángulo máximo (°)', step: '0.1' },
  { key: 'powerMin', label: 'Potencia mínima (u)', step: '0.1' },
  { key: 'powerMax', label: 'Potencia máxima (u)', step: '0.1' },
  { key: 'solutions', label: 'Soluciones solicitadas', step: '1' },
  { key: 'evaluations', label: 'Evaluaciones máximas', step: '1' },
  { key: 'timeMs', label: 'Tiempo máximo (ms)', step: '100' },
];

export function InverseSolverPanel({ simulation, previewVisible, onPreview, onApply }: Props) {
  const [controller] = useState(createSolverWorkerController);
  const subscribe = useCallback(
    (notify: () => void) => controller.subscribe(() => notify()),
    [controller],
  );
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [form, setForm] = useState(() => initialSearchForm(simulation));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resultValid, setResultValid] = useState(false);
  const [selected, setSelected] = useState<SolverCandidate | null>(null);
  const [comparing, setComparing] = useState(false);
  useEffect(() => () => controller.dispose(), [controller]);

  const target = useMemo(
    () => simulation.collisions.targets.find((item) => item.id === form.targetId),
    [form.targetId, simulation],
  );
  const result = resultValid ? snapshot.result : null;
  const candidates = result?.solutions ?? [];
  const busy = resultValid && snapshot.state === 'running';
  const error =
    validationError ?? (resultValid && snapshot.state === 'error' ? snapshot.error : null);
  const status = error
    ? 'Error de búsqueda'
    : busy
      ? 'Buscando soluciones'
      : resultValid && snapshot.state === 'cancelled'
        ? 'Búsqueda cancelada'
        : solverResultStatus(result);
  const progress = resultValid ? snapshot.progress : null;
  const low = candidates.find((item) => item.arc === 'low' && isConfirmedHit(item, form.targetId));
  const high = candidates.find(
    (item) => item.arc === 'high' && isConfirmedHit(item, form.targetId),
  );
  const validSelected = Boolean(selected && isConfirmedHit(selected, form.targetId));

  function edit(key: FormKey, value: string) {
    controller.cancel();
    setForm((previous) => ({ ...previous, [key]: value }));
    setValidationError(null);
    setResultValid(false);
    setSelected(null);
    setComparing(false);
    onPreview(null);
  }
  function search() {
    const parsed = validateSolverForm(form, simulation);
    if (!parsed.input) {
      setValidationError(parsed.error);
      setResultValid(false);
      onPreview(null);
      return;
    }
    onPreview(null);
    setSelected(null);
    setComparing(false);
    setValidationError(null);
    setResultValid(true);
    controller.start(parsed.input);
  }
  function preview(candidate: SolverCandidate) {
    setSelected(candidate);
    setComparing(false);
    onPreview(candidate);
  }
  const delta = target
    ? {
        x: target.center.x - simulation.launchPosition.x,
        y: target.center.y - simulation.launchPosition.y,
      }
    : null;

  return (
    <section className="solver-panel panel" aria-labelledby="solver-panel-title">
      <div className="solver-heading">
        <div>
          <p className="eyebrow">FASE 3D · CÁLCULO INDEPENDIENTE</p>
          <h2 id="solver-panel-title">
            <Crosshair size={18} aria-hidden="true" /> SOLUCIONADOR INVERSO
          </h2>
          <p>
            Explora ángulos y potencias con la física del espacio actual. Solo la simulación
            completa confirma un impacto.
          </p>
        </div>
        <span className="solver-state" data-state={busy ? 'running' : 'idle'}>
          {status}
        </span>
      </div>
      <div className="solver-content">
        <form
          className="solver-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
        >
          <div className="solver-subtitle">
            <Target size={14} aria-hidden="true" /> OBJETIVO
          </div>
          <label className="solver-field">
            <span>Objetivo seleccionado</span>
            <select
              aria-label="Objetivo del solucionador"
              value={form.targetId}
              onChange={(event) => edit('targetId', event.target.value)}
            >
              {simulation.collisions.targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </label>
          <div className="solver-target-stats">
            <span>
              ΔX <strong>{delta?.x.toFixed(2) ?? '—'} u</strong>
            </span>
            <span>
              ΔY <strong>{delta?.y.toFixed(2) ?? '—'} u</strong>
            </span>
            <span>
              Radio <strong>{target?.radius.toFixed(2) ?? '—'} u</strong>
            </span>
          </div>
          <div className="solver-subtitle">
            <Layers3 size={14} aria-hidden="true" /> PARÁMETROS DE BÚSQUEDA
          </div>
          <div className="solver-field-grid">
            {fields.map((field) => (
              <label key={field.key} className="solver-field">
                <span>{field.label}</span>
                <input
                  type="number"
                  step={field.step}
                  inputMode="decimal"
                  aria-label={field.label}
                  value={form[field.key]}
                  onChange={(event) => edit(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="solver-small">
            Potencia válida: {simulation.powerModel.minimumPower}–
            {simulation.powerModel.maximumPower} u. Límites duros: 4096 evaluaciones y 5000 ms.
          </p>
          {error ? (
            <p className="solver-alert" role="alert">
              {error}
            </p>
          ) : null}
          <div className="solver-actions">
            <button className="button primary" type="submit">
              {busy ? (
                <RotateCcw size={15} aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              {busy ? 'Reiniciar búsqueda' : 'Buscar soluciones'}
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={!busy}
              onClick={() => {
                controller.cancel();
                onPreview(null);
                setSelected(null);
              }}
            >
              <Ban size={14} aria-hidden="true" /> Cancelar búsqueda
            </button>
          </div>
        </form>
        <div className="solver-output">
          <div className="solver-output-heading">
            <span className="solver-subtitle">RESULTADOS Y PROGRESO</span>
            <span>{candidates.length} candidatos</span>
          </div>
          <div className="solver-progress" role="status" aria-live="polite" aria-atomic="true">
            <strong>{status}</strong>
            {progress ? (
              <>
                <div
                  className="solver-progress-track"
                  role="progressbar"
                  aria-label="Presupuesto de evaluaciones utilizado"
                  aria-valuemin={0}
                  aria-valuenow={progress.evaluatedCandidates}
                  aria-valuemax={numberOf(form.evaluations)}
                >
                  <span
                    style={{
                      width:
                        String(
                          Math.min(
                            100,
                            (progress.evaluatedCandidates / numberOf(form.evaluations)) * 100,
                          ),
                        ) + '%',
                    }}
                  />
                </div>
                <div className="solver-progress-grid">
                  <span>
                    Etapa{' '}
                    <strong>
                      {progress.phase === 'coarse'
                        ? 'Exploración'
                        : progress.phase === 'refinement'
                          ? 'Refinamiento'
                          : 'Completada'}
                    </strong>
                  </span>
                  <span>
                    Evaluaciones{' '}
                    <strong>
                      {progress.evaluatedCandidates} / {form.evaluations}
                    </strong>
                  </span>
                  <span>
                    Exploración <strong>{progress.coarseEvaluations}</strong>
                  </span>
                  <span>
                    Refinamiento <strong>{progress.refinementEvaluations}</strong>
                  </span>
                  <span>
                    Verificaciones <strong>{progress.verificationEvaluations}</strong>
                  </span>
                  <span>
                    Impactos <strong>{progress.hitCount}</strong>
                  </span>
                  <span>
                    Tiempo <strong>{(progress.elapsedMilliseconds / 1000).toFixed(2)} s</strong>
                  </span>
                </div>
                <small>
                  La barra indica presupuesto consumido, no porcentaje de búsqueda completada.
                </small>
              </>
            ) : (
              <p>El laboratorio permanece interactivo mientras el Worker calcula.</p>
            )}
          </div>
          {result?.status === 'no-solution' ? (
            <p className="solver-note">
              No se observó ningún impacto durante esta búsqueda finita; no demuestra imposibilidad.
            </p>
          ) : null}
          {result?.status === 'budget-exhausted' ? (
            <p className="solver-note">
              Presupuesto agotado. Los candidatos son parciales y pueden existir soluciones mejores.
            </p>
          ) : null}
          {result?.status === 'invalid-input' ? (
            <p className="solver-alert" role="alert">
              {result.messages.map((item) => item.message).join(' ')}
            </p>
          ) : null}
          {low && high ? (
            <button
              type="button"
              className="button ghost solver-compare"
              onClick={() => {
                setSelected(low);
                setComparing(true);
                onPreview(low, high);
              }}
            >
              <Layers3 size={14} aria-hidden="true" />
              {comparing ? 'Comparando arcos bajo y alto' : 'Comparar arco bajo y alto'}
            </button>
          ) : null}
          <ol className="solver-results" aria-label="Candidatos del solucionador">
            {candidates.map((candidate, index) => {
              const hit = isConfirmedHit(candidate, form.targetId);
              const active = selected === candidate && previewVisible;
              return (
                <li key={String(candidate.angleDegrees) + ':' + String(candidate.power)}>
                  <button
                    type="button"
                    className={'solver-result' + (active ? ' selected' : '')}
                    aria-pressed={active}
                    aria-label={
                      'Visualizar candidato ' +
                      (index + 1) +
                      ', ' +
                      candidate.angleDegrees.toFixed(2) +
                      ' grados, potencia ' +
                      candidate.power.toFixed(2)
                    }
                    onClick={() => preview(candidate)}
                  >
                    <span className="solver-result-top">
                      <strong>
                        #{index + 1} · {candidate.angleDegrees.toFixed(2)}° /{' '}
                        {candidate.power.toFixed(2)} u
                      </strong>
                      <span className={hit ? 'solver-hit' : 'solver-miss'}>
                        {hit ? (
                          <CheckCircle2 size={12} aria-hidden="true" />
                        ) : (
                          <CircleDashed size={12} aria-hidden="true" />
                        )}
                        {hit ? 'Impacto verificado' : 'Aproximación'}
                      </span>
                    </span>
                    <span className="solver-result-type">
                      Arco{' '}
                      {candidate.arc === 'low'
                        ? 'bajo'
                        : candidate.arc === 'high'
                          ? 'alto'
                          : 'indeterminado'}
                    </span>
                    <span className="solver-result-metrics">
                      <span>
                        Distancia <b>{candidate.missDistance.toFixed(3)} u</b>
                      </span>
                      <span>
                        Vuelo <b>{candidate.flightTimeSeconds.toFixed(3)} s</b>
                      </span>
                      <span>
                        Ápice <b>{candidate.maximumHeight.toFixed(2)} u</b>
                      </span>
                    </span>
                    <span className="solver-termination">
                      Terminación: {candidate.terminationReason}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {selected ? (
            <div className="solver-selection-actions">
              {previewVisible ? (
                <button type="button" className="button ghost" onClick={() => onPreview(null)}>
                  <EyeOff size={14} aria-hidden="true" /> Ocultar trayectoria inversa
                </button>
              ) : (
                <button type="button" className="button ghost" onClick={() => onPreview(selected)}>
                  <Crosshair size={14} aria-hidden="true" /> Mostrar trayectoria inversa
                </button>
              )}
              <button
                type="button"
                className="button primary"
                disabled={!validSelected || !previewVisible}
                onClick={() => {
                  if (selected && validSelected) onApply(selected);
                }}
              >
                Aplicar esta solución
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
