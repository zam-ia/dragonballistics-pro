import type { SolverInput, SolverProgress, SolverResult } from '@dragonballistics/physics';

export type SolverWorkerRequest =
  { type: 'START'; jobId: string; input: SolverInput } | { type: 'CANCEL'; jobId: string };

export type SolverWorkerResponse =
  | { type: 'PROGRESS'; jobId: string; progress: SolverProgress }
  | { type: 'RESULT'; jobId: string; result: SolverResult }
  | { type: 'ERROR'; jobId: string; code: string; message: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function vector(value: unknown): boolean {
  return record(value) && finite(value.x) && finite(value.y);
}

function range(value: unknown): boolean {
  return record(value) && finite(value.minimum) && finite(value.maximum);
}

function solverShape(value: unknown): value is SolverInput {
  if (!record(value) || !record(value.simulation)) return false;
  const simulation = value.simulation;
  if (
    !record(simulation.powerModel) ||
    !record(simulation.environment) ||
    !record(simulation.bounds) ||
    !record(simulation.collisions)
  )
    return false;
  const model = simulation.powerModel;
  const environment = simulation.environment;
  const bounds = simulation.bounds;
  const collisions = simulation.collisions;
  if (!record(environment.wind)) return false;
  const wind = environment.wind;
  const validWind =
    wind.kind === 'none' ||
    ((wind.kind === 'acceleration' || wind.kind === 'linear-drag') &&
      finite(wind.magnitude) &&
      finite(wind.directionDegrees) &&
      (wind.kind !== 'linear-drag' || finite(wind.dragCoefficientPerSecond)));
  if (
    !validWind ||
    model.kind !== 'linear' ||
    ![model.baseSpeed, model.speedPerPowerUnit, model.minimumPower, model.maximumPower].every(
      finite,
    ) ||
    ![bounds.minimumX, bounds.maximumX, bounds.minimumY, bounds.maximumY].every(finite) ||
    !vector(simulation.launchPosition) ||
    !vector(environment.additionalAcceleration) ||
    ![
      simulation.launchAngleDegrees,
      simulation.power,
      simulation.timeStepSeconds,
      simulation.maximumTimeSeconds,
      simulation.maximumIterations,
      environment.gravity,
    ].every(finite) ||
    !['rk4', 'semi-implicit-euler'].includes(String(simulation.integrator)) ||
    !Array.isArray(collisions.terrain) ||
    !collisions.terrain.every(
      (segment: unknown) => record(segment) && vector(segment.start) && vector(segment.end),
    ) ||
    !Array.isArray(collisions.targets) ||
    !collisions.targets.every(
      (target: unknown) =>
        record(target) &&
        typeof target.id === 'string' &&
        vector(target.center) &&
        finite(target.radius),
    ) ||
    (collisions.groundY !== undefined && !finite(collisions.groundY))
  )
    return false;

  return (
    typeof value.targetId === 'string' &&
    range(value.angleRange) &&
    range(value.powerRange) &&
    finite(value.requestedSolutions) &&
    (value.budgets === undefined ||
      (record(value.budgets) &&
        ['maximumEvaluations', 'maximumWallTimeMs', 'coarseFraction', 'refinementRounds'].every(
          (key) =>
            value.budgets === undefined ||
            (record(value.budgets) &&
              (value.budgets[key] === undefined || finite(value.budgets[key]))),
        )))
  );
}

export function parseWorkerRequest(value: unknown): SolverWorkerRequest | null {
  if (
    !record(value) ||
    typeof value.jobId !== 'string' ||
    value.jobId.length < 1 ||
    value.jobId.length > 128
  )
    return null;
  if (value.type === 'CANCEL') return { type: 'CANCEL', jobId: value.jobId };
  if (value.type === 'START' && solverShape(value.input)) {
    return { type: 'START', jobId: value.jobId, input: value.input };
  }
  return null;
}

const TERMINATIONS = [
  'ground-impact',
  'terrain-impact',
  'target-impact',
  'out-of-bounds',
  'maximum-time',
  'maximum-iterations',
  'invalid-numeric-state',
  'invalid-input',
];
const STATUSES = ['succeeded', 'no-solution', 'invalid-input', 'budget-exhausted', 'cancelled'];
const STOP_REASONS = ['completed', 'evaluation-limit', 'time-limit', 'cancelled'];
function nonnegative(value: unknown): value is number {
  return finite(value) && value >= 0;
}
function nonnegativeInteger(value: unknown): value is number {
  return nonnegative(value) && Number.isInteger(value);
}
function validImpact(value: unknown): boolean {
  return (
    value === null ||
    (record(value) &&
      ['ground', 'terrain', 'target'].includes(String(value.kind)) &&
      vector(value.point) &&
      vector(value.normal) &&
      nonnegative(value.elapsedSeconds) &&
      (value.kind !== 'target' ||
        (typeof value.targetId === 'string' && value.targetId.length > 0)) &&
      (value.terrainSegmentIndex === undefined || nonnegativeInteger(value.terrainSegmentIndex)))
  );
}
function validClosest(value: unknown): boolean {
  return (
    value === null ||
    (record(value) &&
      typeof value.targetId === 'string' &&
      value.targetId.length > 0 &&
      vector(value.point) &&
      nonnegative(value.elapsedSeconds) &&
      nonnegative(value.centerDistance) &&
      nonnegative(value.surfaceDistance) &&
      nonnegative(value.spatialTolerance))
  );
}
function validCandidate(value: unknown): boolean {
  if (!record(value)) return false;
  if (
    ![
      value.angleDegrees,
      value.power,
      value.score,
      value.missDistance,
      value.flightTimeSeconds,
      value.maximumHeight,
    ].every(finite) ||
    !nonnegative(value.score) ||
    !nonnegative(value.missDistance) ||
    !nonnegative(value.flightTimeSeconds) ||
    !['low', 'high', 'undetermined'].includes(String(value.arc)) ||
    !TERMINATIONS.includes(String(value.terminationReason)) ||
    typeof value.hit !== 'boolean' ||
    typeof value.verifiedWithFullSimulation !== 'boolean' ||
    !validImpact(value.impact) ||
    !validClosest(value.closestApproach)
  )
    return false;
  if (value.hit) {
    if (
      !value.verifiedWithFullSimulation ||
      value.terminationReason !== 'target-impact' ||
      !record(value.impact) ||
      value.impact.kind !== 'target' ||
      typeof value.impact.targetId !== 'string' ||
      value.impact.targetId.length === 0
    )
      return false;
  }
  return true;
}
function validResult(value: unknown): value is SolverResult {
  if (
    !record(value) ||
    !STATUSES.includes(String(value.status)) ||
    !Array.isArray(value.solutions) ||
    value.solutions.length > 16 ||
    !value.solutions.every(validCandidate) ||
    ![
      value.evaluatedCandidates,
      value.coarseEvaluations,
      value.refinementEvaluations,
      value.verificationEvaluations,
      value.hitCount,
    ].every(nonnegativeInteger) ||
    ![value.elapsedMilliseconds, value.coarseMilliseconds, value.refinementMilliseconds].every(
      nonnegative,
    ) ||
    !STOP_REASONS.includes(String(value.stopReason)) ||
    ![null, 'evaluations', 'time'].includes(value.exhaustedBudget as string | null) ||
    !Array.isArray(value.messages) ||
    !value.messages.every(
      (message: unknown) =>
        record(message) && typeof message.code === 'string' && typeof message.message === 'string',
    )
  )
    return false;

  if (
    value.evaluatedCandidates !==
      (value.coarseEvaluations as number) +
        (value.refinementEvaluations as number) +
        (value.verificationEvaluations as number) ||
    (value.hitCount as number) > (value.verificationEvaluations as number) ||
    value.solutions.filter((candidate: unknown) => record(candidate) && candidate.hit).length >
      (value.hitCount as number)
  )
    return false;
  if (value.status === 'succeeded' && value.hitCount === 0) return false;
  if (value.status === 'no-solution' && value.hitCount !== 0) return false;
  if (value.status === 'invalid-input' && value.evaluatedCandidates !== 0) return false;
  if (value.status === 'cancelled' && value.stopReason !== 'cancelled') return false;
  if (
    value.status === 'budget-exhausted' &&
    !(value.stopReason === 'evaluation-limit' || value.stopReason === 'time-limit')
  )
    return false;
  return true;
}
export function parseWorkerResponse(value: unknown): SolverWorkerResponse | null {
  if (
    !record(value) ||
    typeof value.jobId !== 'string' ||
    value.jobId.length < 1 ||
    value.jobId.length > 128
  )
    return null;
  if (
    value.type === 'ERROR' &&
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.message === 'string'
  ) {
    return { type: 'ERROR', jobId: value.jobId, code: value.code, message: value.message };
  }
  if (value.type === 'PROGRESS' && record(value.progress)) {
    const p = value.progress;
    if (
      ['coarse', 'refinement', 'complete'].includes(String(p.phase)) &&
      [
        p.evaluatedCandidates,
        p.coarseEvaluations,
        p.refinementEvaluations,
        p.verificationEvaluations,
        p.hitCount,
      ].every(nonnegativeInteger) &&
      nonnegative(p.elapsedMilliseconds) &&
      p.evaluatedCandidates ===
        (p.coarseEvaluations as number) +
          (p.refinementEvaluations as number) +
          (p.verificationEvaluations as number) &&
      (p.hitCount as number) <= (p.verificationEvaluations as number)
    ) {
      return { type: 'PROGRESS', jobId: value.jobId, progress: p as unknown as SolverProgress };
    }
  }
  if (value.type === 'RESULT' && validResult(value.result)) {
    return { type: 'RESULT', jobId: value.jobId, result: value.result };
  }
  return null;
}
