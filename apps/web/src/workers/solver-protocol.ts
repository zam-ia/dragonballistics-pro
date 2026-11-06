import type { SolverInput, SolverProgress, SolverResult } from '@dragonballistics/physics';

export type SolverWorkerRequest =
  | { type: 'START'; jobId: string; input: SolverInput }
  | { type: 'CANCEL'; jobId: string };

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
  if (!record(simulation.powerModel) || !record(simulation.environment) ||
      !record(simulation.bounds) || !record(simulation.collisions)) return false;
  const model = simulation.powerModel;
  const environment = simulation.environment;
  const bounds = simulation.bounds;
  const collisions = simulation.collisions;
  if (!record(environment.wind)) return false;
  const wind = environment.wind;
  const validWind =
    wind.kind === 'none' ||
    ((wind.kind === 'acceleration' || wind.kind === 'linear-drag') &&
      finite(wind.magnitude) && finite(wind.directionDegrees) &&
      (wind.kind !== 'linear-drag' || finite(wind.dragCoefficientPerSecond)));
  if (!validWind ||
      model.kind !== 'linear' ||
      ![model.baseSpeed, model.speedPerPowerUnit, model.minimumPower, model.maximumPower].every(finite) ||
      ![bounds.minimumX, bounds.maximumX, bounds.minimumY, bounds.maximumY].every(finite) ||
      !vector(simulation.launchPosition) || !vector(environment.additionalAcceleration) ||
      ![simulation.launchAngleDegrees, simulation.power, simulation.timeStepSeconds,
        simulation.maximumTimeSeconds, simulation.maximumIterations, environment.gravity].every(finite) ||
      !['rk4', 'semi-implicit-euler'].includes(String(simulation.integrator)) ||
      !Array.isArray(collisions.terrain) ||
      !collisions.terrain.every((segment: unknown) =>
        record(segment) && vector(segment.start) && vector(segment.end)) ||
      !Array.isArray(collisions.targets) ||
      !collisions.targets.every((target: unknown) =>
        record(target) && typeof target.id === 'string' &&
        vector(target.center) && finite(target.radius)) ||
      (collisions.groundY !== undefined && !finite(collisions.groundY))) return false;

  return typeof value.targetId === 'string' &&
    range(value.angleRange) && range(value.powerRange) &&
    finite(value.requestedSolutions) &&
    (value.budgets === undefined ||
      (record(value.budgets) &&
        ['maximumEvaluations', 'maximumWallTimeMs', 'coarseFraction', 'refinementRounds']
          .every((key) => value.budgets === undefined ||
            (record(value.budgets) &&
              (value.budgets[key] === undefined || finite(value.budgets[key]))))));
}

export function parseWorkerRequest(value: unknown): SolverWorkerRequest | null {
  if (!record(value) || typeof value.jobId !== 'string' ||
      value.jobId.length < 1 || value.jobId.length > 128) return null;
  if (value.type === 'CANCEL') return { type: 'CANCEL', jobId: value.jobId };
  if (value.type === 'START' && solverShape(value.input)) {
    return { type: 'START', jobId: value.jobId, input: value.input };
  }
  return null;
}

export function parseWorkerResponse(value: unknown): SolverWorkerResponse | null {
  if (!record(value) || typeof value.jobId !== 'string' || value.jobId.length === 0) return null;
  if (value.type === 'ERROR' && typeof value.code === 'string' &&
      typeof value.message === 'string') {
    return { type: 'ERROR', jobId: value.jobId, code: value.code, message: value.message };
  }
  if (value.type === 'PROGRESS' && record(value.progress)) {
    const p = value.progress;
    if ((p.phase === 'coarse' || p.phase === 'refinement' || p.phase === 'complete') &&
        [p.evaluatedCandidates, p.coarseEvaluations, p.refinementEvaluations,
          p.verificationEvaluations, p.hitCount, p.elapsedMilliseconds]
          .every((v) => finite(v) && v >= 0)) {
      return { type: 'PROGRESS', jobId: value.jobId, progress: p as unknown as SolverProgress };
    }
  }
  if (value.type === 'RESULT' && record(value.result)) {
    const r = value.result;
    if (['succeeded', 'no-solution', 'invalid-input', 'budget-exhausted', 'cancelled']
      .includes(String(r.status)) &&
      Array.isArray(r.solutions) && finite(r.evaluatedCandidates) &&
      finite(r.verificationEvaluations) && finite(r.hitCount) &&
      r.solutions.every((c: unknown) =>
        record(c) && finite(c.angleDegrees) && finite(c.power) &&
        typeof c.hit === 'boolean' && (!c.hit || c.verifiedWithFullSimulation === true))) {
      return { type: 'RESULT', jobId: value.jobId, result: r as unknown as SolverResult };
    }
  }
  return null;
}
