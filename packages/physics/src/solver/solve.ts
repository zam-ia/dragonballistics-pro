import { evaluateProjectileSummary, simulateProjectile } from '../simulation';
import { validateSimulationInput } from '../validation';
import type { SimulationInput, SimulationMessage, SimulationSummary } from '../types';
import {
  DEFAULT_SOLVER_BUDGETS,
  SOLVER_HARD_LIMITS,
  type SolverBudgets,
  type SolverCandidate,
  type SolverExecutionOptions,
  type SolverInput,
  type SolverPhase,
  type SolverProgress,
  type SolverRange,
  type SolverResult,
  type SolverStopReason,
} from './types';

const IMPROVEMENT_EPSILON = 1e-10;
const DEFAULT_COARSE_EVALUATIONS = 128;
const HIGH_RESOLUTION_COARSE_EVALUATIONS = 48;

interface SearchEntry {
  candidate: SolverCandidate;
  provisionalHit: boolean;
}

interface ValidatedInput {
  budgets: SolverBudgets;
  errors: SimulationMessage[];
}

function validateSolverInput(input: SolverInput): ValidatedInput {
  const errors: SimulationMessage[] = [];
  const reject = (code: string, message: string) => errors.push({ code, message });
  const budgets = { ...DEFAULT_SOLVER_BUDGETS, ...input.budgets };
  const range = (value: SolverRange, name: string) => {
    if (
      !value ||
      !Number.isFinite(value.minimum) ||
      !Number.isFinite(value.maximum) ||
      value.minimum > value.maximum
    ) {
      reject('invalid-solver-range', name + ' requiere extremos finitos y ordenados.');
    }
  };

  range(input.angleRange, 'angleRange');
  range(input.powerRange, 'powerRange');
  if (input.angleRange && (input.angleRange.minimum < -360 || input.angleRange.maximum > 360)) {
    reject('invalid-angle-range', 'Los angulos deben estar entre -360 y 360 grados.');
  }
  if (
    input.powerRange &&
    (input.powerRange.minimum < input.simulation.powerModel.minimumPower ||
      input.powerRange.maximum > input.simulation.powerModel.maximumPower)
  ) {
    reject('invalid-power-range', 'El rango de potencia supera el modelo fisico.');
  }
  if (
    !input.targetId ||
    !input.simulation.collisions.targets.some((t) => t.id === input.targetId)
  ) {
    reject('target-not-found', 'No existe el objetivo seleccionado.');
  }
  if (
    !Number.isInteger(input.requestedSolutions) ||
    input.requestedSolutions < 1 ||
    input.requestedSolutions > SOLVER_HARD_LIMITS.requestedSolutions
  ) {
    reject('invalid-solution-count', 'requestedSolutions debe estar entre 1 y 16.');
  }
  if (
    !Number.isInteger(budgets.maximumEvaluations) ||
    budgets.maximumEvaluations < 1 ||
    budgets.maximumEvaluations > SOLVER_HARD_LIMITS.maximumEvaluations
  ) {
    reject('invalid-evaluation-budget', 'maximumEvaluations debe estar entre 1 y 4096.');
  }
  if (
    !Number.isFinite(budgets.maximumWallTimeMs) ||
    budgets.maximumWallTimeMs <= 0 ||
    budgets.maximumWallTimeMs > SOLVER_HARD_LIMITS.maximumWallTimeMs
  ) {
    reject('invalid-time-budget', 'maximumWallTimeMs debe estar en (0, 5000].');
  }
  if (
    !Number.isFinite(budgets.coarseFraction) ||
    budgets.coarseFraction <= 0 ||
    budgets.coarseFraction > 1
  ) {
    reject('invalid-coarse-fraction', 'coarseFraction debe estar en (0, 1].');
  }
  if (
    !Number.isInteger(budgets.refinementRounds) ||
    budgets.refinementRounds < 1 ||
    budgets.refinementRounds > SOLVER_HARD_LIMITS.refinementRounds
  ) {
    reject('invalid-refinement-rounds', 'refinementRounds debe estar entre 1 y 10.');
  }
  // The model validates the launch angle and power on the simulation template. For a
  // solver, candidate values replace these fields; validate with one admissible pair.
  const simulation = {
    ...input.simulation,
    launchAngleDegrees: Number.isFinite(input.angleRange?.minimum)
      ? input.angleRange.minimum
      : input.simulation.launchAngleDegrees,
    power: Number.isFinite(input.powerRange?.minimum)
      ? input.powerRange.minimum
      : input.simulation.power,
  };
  errors.push(...validateSimulationInput(simulation).errors);
  return { budgets, errors };
}

function identity(angle: number, power: number): string {
  // Exact IEEE-754 values: no coarse decimal rounding that might collapse tiny targets.
  return String(angle === 0 ? 0 : angle) + ':' + String(power === 0 ? 0 : power);
}

function compareEntries(a: SearchEntry, b: SearchEntry): number {
  if (a.provisionalHit !== b.provisionalHit) return a.provisionalHit ? -1 : 1;
  const x = a.candidate;
  const y = b.candidate;
  return (
    x.missDistance - y.missDistance ||
    x.power - y.power ||
    x.flightTimeSeconds - y.flightTimeSeconds ||
    x.angleDegrees - y.angleDegrees
  );
}

function sample(range: SolverRange, index: number, denominator: number): number {
  if (denominator === 0 || range.minimum === range.maximum) return range.minimum;
  if (index === 0) return range.minimum;
  if (index === denominator) return range.maximum;
  return range.minimum + ((range.maximum - range.minimum) * index) / denominator;
}

/**
 * Progressive 3x3, 5x5, 9x9, ... nested grids, emitting only previously unseen points.
 * Every completed level includes endpoints and center on both dimensions. The first
 * level alternates angle/power extremes with center to preserve diversity on short jobs.
 */
function* coarsePoints(angle: SolverRange, power: SolverRange): Generator<[number, number]> {
  const seen = new Set<string>();
  const fixedAngle = angle.minimum === angle.maximum;
  const fixedPower = power.minimum === power.maximum;
  for (let level = 1; level <= 12; level += 1) {
    const denominator = 2 ** level;
    const angleIndices = fixedAngle ? [0] : [0, denominator / 2, denominator];
    const powerIndices = fixedPower ? [0] : [0, denominator / 2, denominator];
    if (level > 1) {
      angleIndices.length = 0;
      powerIndices.length = 0;
      for (let n = 0; n <= denominator; n += 1) {
        if (!fixedAngle || n === 0) angleIndices.push(n);
        if (!fixedPower || n === 0) powerIndices.push(n);
      }
    }
    // At a given level, walk the angle bands in alternating directions. Center
    // comes early at level one; later levels fill interstitial regions evenly.
    for (const ai of angleIndices) {
      for (const pi of powerIndices) {
        const a = sample(angle, ai, denominator);
        const p = sample(power, pi, denominator);
        const key = identity(a, p);
        if (seen.has(key)) continue;
        seen.add(key);
        yield [a, p];
      }
    }
    if (fixedAngle && fixedPower) break;
  }
}

function entryFromSummary(
  angle: number,
  power: number,
  summary: SimulationSummary,
  targetId: string,
): SearchEntry {
  const provisionalHit =
    summary.terminationReason === 'target-impact' &&
    summary.impact?.kind === 'target' &&
    summary.impact.targetId === targetId;
  const missDistance = provisionalHit
    ? 0
    : (summary.closestApproach?.surfaceDistance ?? Number.MAX_VALUE);
  return {
    provisionalHit,
    candidate: {
      angleDegrees: angle,
      power,
      arc: 'undetermined',
      hit: false,
      verifiedWithFullSimulation: false,
      score: missDistance,
      missDistance,
      closestApproach: summary.closestApproach,
      impact: summary.impact,
      flightTimeSeconds: summary.flightTimeSeconds,
      maximumHeight: summary.maximumHeight,
      terminationReason: summary.terminationReason,
    },
  };
}

function diverseSeeds(entries: SearchEntry[], angle: SolverRange, maximum: number): SearchEntry[] {
  const span = angle.maximum - angle.minimum;
  const bands = span === 0 ? 1 : Math.min(8, Math.max(2, Math.floor(Math.sqrt(entries.length))));
  const best = new Map<number, SearchEntry>();
  for (const entry of entries) {
    const band =
      span === 0
        ? 0
        : Math.min(
            bands - 1,
            Math.floor(((entry.candidate.angleDegrees - angle.minimum) / span) * bands),
          );
    const previous = best.get(band);
    if (!previous || compareEntries(entry, previous) < 0) best.set(band, entry);
  }
  return [...best.values()].sort(compareEntries).slice(0, maximum);
}

/** Distinct parameter solutions require separation, and distinct arcs require apex separation too. */
function deduplicate(
  entries: SearchEntry[],
  angle: SolverRange,
  power: SolverRange,
): SearchEntry[] {
  const angleEps = Math.max(0.12, (angle.maximum - angle.minimum) / 512);
  const powerEps = Math.max(0.02, (power.maximum - power.minimum) / 512);
  const kept: SearchEntry[] = [];
  for (const entry of [...entries].sort(compareEntries)) {
    if (
      kept.some(
        (other) =>
          Math.abs(other.candidate.angleDegrees - entry.candidate.angleDegrees) <= angleEps &&
          Math.abs(other.candidate.power - entry.candidate.power) <= powerEps,
      )
    )
      continue;
    kept.push(entry);
  }
  return kept;
}

function classifyArcs(entries: SearchEntry[], input: SolverInput): void {
  const hits = entries.filter((entry) => entry.candidate.hit);
  if (hits.length < 2) return;
  const target = input.simulation.collisions.targets.find((t) => t.id === input.targetId)!;
  const sorted = [...hits].sort((a, b) => a.candidate.angleDegrees - b.candidate.angleDegrees);
  const angleGap = Math.max(8, (input.angleRange.maximum - input.angleRange.minimum) / 10);
  const basins: SearchEntry[][] = [];
  for (const hit of sorted) {
    const last = basins[basins.length - 1];
    if (
      !last ||
      hit.candidate.angleDegrees - last[last.length - 1].candidate.angleDegrees > angleGap
    ) {
      basins.push([hit]);
    } else {
      last.push(hit);
    }
  }
  if (basins.length < 2) return;
  const apexFor = (basin: SearchEntry[]) =>
    basin.reduce((sum, e) => sum + e.candidate.maximumHeight, 0) / basin.length;
  const byHeight = [...basins].sort((a, b) => apexFor(a) - apexFor(b));
  const minimumSeparation = Math.max(target.radius * 2, 0.5);
  if (apexFor(byHeight[byHeight.length - 1]) - apexFor(byHeight[0]) <= minimumSeparation) return;
  for (const entry of byHeight[0]) entry.candidate.arc = 'low';
  for (const entry of byHeight[byHeight.length - 1]) entry.candidate.arc = 'high';
}

/**
 * Synchronous, framework-independent search. Deterministic for the same input and
 * clock/cancellation sequence. A deadline is checked between evaluations, not inside
 * a single physics call; wall time can overrun by the last evaluation's duration.
 */
export function solveProjectile(
  input: SolverInput,
  options: SolverExecutionOptions = {},
): SolverResult {
  const now = options.now ?? (() => performance.now());
  const started = now();
  let lastTime = started;
  const elapsed = () => {
    lastTime = Math.max(lastTime, now());
    return Math.max(0, lastTime - started);
  };
  const { budgets, errors } = validateSolverInput(input);
  const entries: SearchEntry[] = [];
  const cache = new Map<string, SearchEntry>();
  let coarseEvaluations = 0;
  let refinementEvaluations = 0;
  let verificationEvaluations = 0;
  let coarseMilliseconds = 0;
  let refinementMilliseconds = 0;
  let phase: SolverPhase = 'coarse';
  let stopReason: SolverStopReason = 'completed';
  let lastProgressAt = 0;

  const evaluated = () => coarseEvaluations + refinementEvaluations + verificationEvaluations;
  const progress = (): SolverProgress => ({
    phase,
    evaluatedCandidates: evaluated(),
    coarseEvaluations,
    refinementEvaluations,
    verificationEvaluations,
    hitCount: entries.filter((e) => e.provisionalHit).length,
    elapsedMilliseconds: elapsed(),
  });
  const notify = (force = false) => {
    if (!options.onProgress) return;
    if (force || evaluated() - lastProgressAt >= 16) {
      lastProgressAt = evaluated();
      options.onProgress(progress());
    }
  };
  const allowed = (): boolean => {
    if (options.isCancelled?.()) {
      stopReason = 'cancelled';
      return false;
    }
    if (elapsed() >= budgets.maximumWallTimeMs) {
      stopReason = 'time-limit';
      return false;
    }
    if (evaluated() >= budgets.maximumEvaluations) {
      stopReason = 'evaluation-limit';
      return false;
    }
    return true;
  };
  const evaluate = (angle: number, power: number): SearchEntry | null => {
    const key = identity(angle, power);
    const existing = cache.get(key);
    if (existing) return existing;
    if (!allowed()) return null;
    const summary = evaluateProjectileSummary(
      { ...input.simulation, launchAngleDegrees: angle, power },
      { targetId: input.targetId },
    );
    const entry = entryFromSummary(angle, power, summary, input.targetId);
    cache.set(key, entry);
    entries.push(entry);
    if (phase === 'coarse') coarseEvaluations += 1;
    else refinementEvaluations += 1;
    notify();
    return entry;
  };

  if (errors.length) {
    return {
      status: 'invalid-input',
      solutions: [],
      evaluatedCandidates: 0,
      coarseEvaluations: 0,
      refinementEvaluations: 0,
      verificationEvaluations: 0,
      hitCount: 0,
      elapsedMilliseconds: elapsed(),
      coarseMilliseconds: 0,
      refinementMilliseconds: 0,
      exhaustedBudget: null,
      stopReason: 'completed',
      messages: errors,
    };
  }

  const coarseStart = elapsed();
  const planningCap =
    input.simulation.timeStepSeconds <= 0.002
      ? HIGH_RESOLUTION_COARSE_EVALUATIONS
      : DEFAULT_COARSE_EVALUATIONS;
  // Reserve time and evaluations for refining and physically verifying impacts.
  const coarseLimit = Math.max(
    1,
    Math.min(planningCap, Math.floor(budgets.maximumEvaluations * budgets.coarseFraction)),
  );
  for (const [angle, power] of coarsePoints(input.angleRange, input.powerRange)) {
    if (coarseEvaluations >= coarseLimit || !allowed()) break;
    evaluate(angle, power);
  }
  coarseMilliseconds = elapsed() - coarseStart;
  phase = 'refinement';
  notify(true);

  if (stopReason === 'completed' && entries.length) {
    const seeds = diverseSeeds(entries, input.angleRange, 4);
    const angleWidth = input.angleRange.maximum - input.angleRange.minimum;
    const powerWidth = input.powerRange.maximum - input.powerRange.minimum;
    const refinementStart = elapsed();
    for (const seed of seeds) {
      let best = seed;
      let angleStep = angleWidth / 8;
      let powerStep = powerWidth / 8;
      for (let round = 0; round < budgets.refinementRounds; round += 1) {
        if (!allowed()) break;
        let improved = false;
        const neighbors: Array<[number, number]> = [];
        for (const da of [-1, 0, 1]) {
          for (const dp of [-1, 0, 1]) {
            if (da === 0 && dp === 0) continue;
            if (angleStep === 0 && da !== 0) continue;
            if (powerStep === 0 && dp !== 0) continue;
            const a = Math.max(
              input.angleRange.minimum,
              Math.min(input.angleRange.maximum, best.candidate.angleDegrees + da * angleStep),
            );
            const p = Math.max(
              input.powerRange.minimum,
              Math.min(input.powerRange.maximum, best.candidate.power + dp * powerStep),
            );
            neighbors.push([a, p]);
          }
        }
        for (const [a, p] of neighbors) {
          const candidate = evaluate(a, p);
          if (!candidate) break;
          if (
            compareEntries(candidate, best) < 0 &&
            (candidate.provisionalHit !== best.provisionalHit ||
              candidate.candidate.missDistance + IMPROVEMENT_EPSILON <
                best.candidate.missDistance ||
              (candidate.provisionalHit &&
                best.provisionalHit &&
                compareEntries(candidate, best) < 0))
          ) {
            best = candidate;
            improved = true;
          }
        }
        if (stopReason !== 'completed') break;
        if (!improved) {
          angleStep /= 2;
          powerStep /= 2;
        }
      }
      if (stopReason !== 'completed') break;
    }
    refinementMilliseconds = elapsed() - refinementStart;
  }

  // A summary hit does not become a reported hit without independent full simulation.
  // Verification also consumes an evaluation slot and the same wall-time budget.
  const provisional = deduplicate(entries, input.angleRange, input.powerRange);
  const hitsToVerify = provisional
    .filter((e) => e.provisionalHit)
    .sort((a, b) => a.candidate.angleDegrees - b.candidate.angleDegrees);
  const verificationOrder =
    hitsToVerify.length < 2
      ? hitsToVerify
      : [hitsToVerify[0], hitsToVerify[hitsToVerify.length - 1], ...hitsToVerify.slice(1, -1)];
  for (const entry of verificationOrder) {
    if (!allowed()) break;
    const full = simulateProjectile({
      ...input.simulation,
      launchAngleDegrees: entry.candidate.angleDegrees,
      power: entry.candidate.power,
    });
    verificationEvaluations += 1;
    const confirmed =
      full.terminationReason === 'target-impact' &&
      full.impact?.kind === 'target' &&
      full.impact.targetId === input.targetId;
    entry.candidate.verifiedWithFullSimulation = true;
    entry.candidate.hit = confirmed;
    entry.provisionalHit = confirmed;
    entry.candidate.impact = full.impact;
    entry.candidate.terminationReason = full.terminationReason;
    entry.candidate.flightTimeSeconds = full.flightTimeSeconds;
    entry.candidate.maximumHeight = full.maximumHeight;
    notify();
  }
  // Unverified summary hits remain approximations, never successful solutions.
  for (const entry of provisional) entry.provisionalHit = entry.candidate.hit;
  classifyArcs(provisional, input);

  const ranked = provisional.sort(compareEntries);
  const selected: SearchEntry[] = [];
  // Preserve a verified low/high pair before filling remaining slots.
  for (const arc of ['low', 'high'] as const) {
    const match = ranked.find((e) => e.candidate.hit && e.candidate.arc === arc);
    if (match && selected.length < input.requestedSolutions) selected.push(match);
  }
  for (const entry of ranked) {
    if (selected.length >= input.requestedSolutions) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  phase = 'complete';
  notify(true);
  const exhaustedBudget =
    stopReason === 'time-limit' ? 'time' : stopReason === 'evaluation-limit' ? 'evaluations' : null;
  const hitCount = provisional.filter((e) => e.candidate.hit).length;
  const status =
    stopReason === 'cancelled'
      ? 'cancelled'
      : exhaustedBudget
        ? 'budget-exhausted'
        : hitCount > 0
          ? 'succeeded'
          : 'no-solution';
  const messages: SimulationMessage[] = [];
  if (stopReason !== 'completed') {
    messages.push({
      code: stopReason,
      message:
        stopReason === 'cancelled'
          ? 'Busqueda cancelada.'
          : stopReason === 'time-limit'
            ? 'Limite temporal alcanzado.'
            : 'Limite de evaluaciones alcanzado.',
    });
  }
  if (status === 'no-solution') {
    messages.push({
      code: 'no-observed-hit',
      message: 'No se encontro impacto en la busqueda finita; no demuestra imposibilidad.',
    });
  }
  return {
    status,
    solutions: selected.map((e) => e.candidate),
    evaluatedCandidates: evaluated(),
    coarseEvaluations,
    refinementEvaluations,
    verificationEvaluations,
    hitCount,
    elapsedMilliseconds: elapsed(),
    coarseMilliseconds,
    refinementMilliseconds,
    exhaustedBudget,
    stopReason,
    messages,
  };
}
