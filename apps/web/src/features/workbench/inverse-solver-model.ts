import { DEFAULT_SOLVER_BUDGETS, SOLVER_HARD_LIMITS, type SimulationInput, type SolverCandidate, type SolverInput, type SolverResult } from '@dragonballistics/physics';

export type FormKey =
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
