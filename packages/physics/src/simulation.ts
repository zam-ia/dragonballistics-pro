import type { Vec2 } from '@dragonballistics/shared';
import {
  findFirstCollision,
  findFirstTrajectoryEvent,
  findInitialTerrainCollision,
} from './collisions';
import type { TrajectoryTargetApproachCandidate } from './collisions';
import { createAccelerationField } from './forces';
import { integrateStep } from './integrators';
import { powerToInitialSpeed } from './power';
import type {
  CollisionCandidate,
  CircularTarget,
  ClosestTargetApproach,
  ImpactResult,
  KinematicState,
  SimulationInput,
  SimulationMessage,
  SimulationResult,
  SimulationSummary,
  SimulationStatus,
  SummaryEvaluationOptions,
  SimulationTerminationReason,
  TrajectoryPoint,
} from './types';
import { validateSimulationInput } from './validation';
import { degreesToRadians } from './wind';

const EPSILON = 1e-10;

export function simulateProjectile(input: SimulationInput): SimulationResult {
  const result = runSimulation(input, {
    captureTrajectory: true,
    proximityTargets: [],
    additionalErrors: [],
  });
  return {
    status: result.status,
    terminationReason: result.terminationReason,
    trajectory: result.trajectory ?? [result.finalState],
    finalPosition: result.finalState.position,
    impact: result.impact,
    flightTimeSeconds: result.flightTimeSeconds,
    horizontalRange: result.horizontalRange,
    maximumHeight: result.maximumHeight,
    apexPoint: result.apexPoint,
    iterations: result.iterations,
    warnings: result.warnings,
    errors: result.errors,
    parametersUsed: result.parametersUsed,
  };
}

export function evaluateProjectileSummary(
  input: SimulationInput,
  options: SummaryEvaluationOptions = {},
): SimulationSummary {
  const { targets, errors } = resolveProximityTargets(input.collisions.targets, options.targetId);
  const result = runSimulation(input, {
    captureTrajectory: false,
    proximityTargets: targets,
    additionalErrors: errors,
  });
  return {
    status: result.status,
    terminationReason: result.terminationReason,
    finalState: result.finalState,
    impact: result.impact,
    flightTimeSeconds: result.flightTimeSeconds,
    horizontalRange: result.horizontalRange,
    maximumHeight: result.maximumHeight,
    apexPoint: result.apexPoint,
    closestApproach: result.closestApproach,
    iterations: result.iterations,
    warnings: result.warnings,
    errors: result.errors,
    parametersUsed: result.parametersUsed,
  };
}

interface RunOptions {
  captureTrajectory: boolean;
  proximityTargets: readonly CircularTarget[];
  additionalErrors: SimulationMessage[];
}

interface CoreSimulationResult {
  status: SimulationStatus;
  terminationReason: SimulationTerminationReason;
  trajectory: TrajectoryPoint[] | null;
  finalState: TrajectoryPoint;
  impact: ImpactResult | null;
  flightTimeSeconds: number;
  horizontalRange: number;
  maximumHeight: number;
  apexPoint: TrajectoryPoint;
  closestApproach: ClosestTargetApproach | null;
  iterations: number;
  warnings: SimulationMessage[];
  errors: SimulationMessage[];
  parametersUsed: { input: SimulationInput; initialSpeed: number | null };
}

function runSimulation(input: SimulationInput, options: RunOptions): CoreSimulationResult {
  const validation = validateSimulationInput(input);
  const validationErrors = [...validation.errors, ...options.additionalErrors];
  const safeLaunch = finiteVectorOrZero(input.launchPosition);
  const emptyPoint: TrajectoryPoint = {
    position: safeLaunch,
    velocity: { x: 0, y: 0 },
    elapsedSeconds: 0,
  };
  if (validationErrors.length > 0) {
    return createResult({
      input,
      initialSpeed: null,
      status: 'invalid',
      terminationReason: 'invalid-input',
      trajectory: options.captureTrajectory ? [emptyPoint] : null,
      finalState: emptyPoint,
      apexPoint: emptyPoint,
      impact: null,
      closestApproach: null,
      iterations: 0,
      warnings: validation.warnings,
      errors: validationErrors,
    });
  }

  const initialSpeed = powerToInitialSpeed(input.power, input.powerModel);
  if (!Number.isFinite(initialSpeed)) {
    return createResult({
      input,
      initialSpeed: null,
      status: 'invalid',
      terminationReason: 'invalid-input',
      trajectory: options.captureTrajectory ? [emptyPoint] : null,
      finalState: emptyPoint,
      apexPoint: emptyPoint,
      impact: null,
      closestApproach: null,
      iterations: 0,
      warnings: validation.warnings,
      errors: [
        {
          code: 'invalid-initial-speed',
          message: 'La transformacion de potencia no produjo una velocidad finita.',
        },
      ],
    });
  }

  const launchRadians = degreesToRadians(input.launchAngleDegrees);
  let state: KinematicState = {
    position: { ...input.launchPosition },
    velocity: {
      x: initialSpeed * Math.cos(launchRadians),
      y: initialSpeed * Math.sin(launchRadians),
    },
    elapsedSeconds: 0,
  };
  const initialPoint = toTrajectoryPoint(state);
  let apexPoint = initialPoint;
  let closestApproach = closestApproachAtPoint(initialPoint, options.proximityTargets);
  const trajectory: TrajectoryPoint[] | null = options.captureTrajectory ? [initialPoint] : null;
  const accelerationField = createAccelerationField(input.environment);

  const initialCollision = findFirstCollision(state.position, state.position, input.collisions);
  if (initialCollision?.kind === 'target') {
    const impact = collisionToImpact(initialCollision, 0);
    return createResult({
      input,
      initialSpeed,
      status: 'completed',
      terminationReason: 'target-impact',
      trajectory,
      finalState: initialPoint,
      apexPoint,
      impact,
      closestApproach,
      iterations: 0,
      warnings: validation.warnings,
      errors: [],
    });
  }
  const initialTerrainCollision = findInitialTerrainCollision(
    state.position,
    state.velocity,
    input.collisions,
  );
  if (initialTerrainCollision) {
    const impact = collisionToImpact(initialTerrainCollision, 0);
    return createResult({
      input,
      initialSpeed,
      status: 'completed',
      terminationReason: 'terrain-impact',
      trajectory,
      finalState: initialPoint,
      apexPoint,
      impact,
      closestApproach,
      iterations: 0,
      warnings: validation.warnings,
      errors: [],
    });
  }
  if (
    input.collisions.groundY !== undefined &&
    Math.abs(state.position.y - input.collisions.groundY) <= EPSILON &&
    state.velocity.y <= 0
  ) {
    const impact: ImpactResult = {
      kind: 'ground',
      point: { ...state.position },
      elapsedSeconds: 0,
      normal: { x: 0, y: 1 },
    };
    return createResult({
      input,
      initialSpeed,
      status: 'completed',
      terminationReason: 'ground-impact',
      trajectory,
      finalState: initialPoint,
      apexPoint,
      impact,
      closestApproach,
      iterations: 0,
      warnings: validation.warnings,
      errors: [],
    });
  }

  for (let iteration = 1; iteration <= input.maximumIterations; iteration += 1) {
    const remainingTime = input.maximumTimeSeconds - state.elapsedSeconds;
    if (remainingTime <= EPSILON) {
      return createResult({
        input,
        initialSpeed,
        status: 'stopped',
        terminationReason: 'maximum-time',
        trajectory,
        finalState: toTrajectoryPoint(state),
        apexPoint,
        impact: null,
        closestApproach,
        iterations: iteration - 1,
        warnings: validation.warnings,
        errors: [],
      });
    }

    const timeStep = Math.min(input.timeStepSeconds, remainingTime);
    const nextState = integrateStep(input.integrator, state, timeStep, accelerationField);
    if (!kinematicStateIsFinite(nextState)) {
      return createResult({
        input,
        initialSpeed,
        status: 'invalid',
        terminationReason: 'invalid-numeric-state',
        trajectory,
        finalState: toTrajectoryPoint(state),
        apexPoint,
        impact: null,
        closestApproach,
        iterations: iteration,
        warnings: validation.warnings,
        errors: [
          { code: 'invalid-numeric-state', message: 'El integrador produjo un estado no finito.' },
        ],
      });
    }

    const stateCache = new Map<number, KinematicState>([
      [0, state],
      [1, nextState],
    ]);
    const stateAtFraction = (fraction: number) => {
      const cached = stateCache.get(fraction);
      if (cached) return cached;
      const partial = partialStateAtFraction(state, timeStep, fraction, input, accelerationField);
      stateCache.set(fraction, partial);
      return partial;
    };
    const {
      collision,
      boundsExit,
      closestApproach: stepClosestApproach,
    } = findFirstTrajectoryEvent(
      (fraction) => stateAtFraction(fraction).position,
      input.collisions,
      input.bounds,
      options.proximityTargets,
    );
    if (stepClosestApproach) {
      closestApproach = nearerClosestApproach(
        closestApproach,
        toClosestTargetApproach(stepClosestApproach, state.elapsedSeconds, timeStep),
      );
    }
    const collisionFirst =
      collision !== null && (boundsExit === null || collision.fraction <= boundsExit.fraction);
    const stoppingFraction = collisionFirst ? collision.fraction : (boundsExit?.fraction ?? 1);

    const apexCandidate = apexWithinStep(
      state,
      nextState,
      timeStep,
      stoppingFraction,
      input,
      accelerationField,
    );
    if (apexCandidate && apexCandidate.position.y > apexPoint.position.y) apexPoint = apexCandidate;

    if (collisionFirst && collision) {
      const finalState = stateAtFraction(collision.fraction);
      finalState.position = collision.point;
      const finalPoint = toTrajectoryPoint(finalState);
      appendUniquePoint(trajectory, finalPoint);
      const impact = collisionToImpact(collision, finalState.elapsedSeconds);
      return createResult({
        input,
        initialSpeed,
        status: 'completed',
        terminationReason: impactReason(collision.kind),
        trajectory,
        finalState: finalPoint,
        apexPoint: higherPoint(apexPoint, finalPoint),
        impact,
        closestApproach,
        iterations: iteration,
        warnings: validation.warnings,
        errors: [],
      });
    }

    if (boundsExit) {
      const finalState = stateAtFraction(boundsExit.fraction);
      finalState.position = boundsExit.point;
      const finalPoint = toTrajectoryPoint(finalState);
      appendUniquePoint(trajectory, finalPoint);
      return createResult({
        input,
        initialSpeed,
        status: 'stopped',
        terminationReason: 'out-of-bounds',
        trajectory,
        finalState: finalPoint,
        apexPoint: higherPoint(apexPoint, finalPoint),
        impact: null,
        closestApproach,
        iterations: iteration,
        warnings: validation.warnings,
        errors: [],
      });
    }

    state = nextState;
    if (trajectory) {
      const nextPoint = toTrajectoryPoint(state);
      trajectory.push(nextPoint);
      apexPoint = higherPoint(apexPoint, nextPoint);
    } else if (state.position.y > apexPoint.position.y) {
      apexPoint = toTrajectoryPoint(state);
    }
  }

  return createResult({
    input,
    initialSpeed,
    status: 'stopped',
    terminationReason: 'maximum-iterations',
    trajectory,
    finalState: toTrajectoryPoint(state),
    apexPoint,
    impact: null,
    closestApproach,
    iterations: input.maximumIterations,
    warnings: validation.warnings,
    errors: [],
  });
}

function apexWithinStep(
  state: KinematicState,
  nextState: KinematicState,
  timeStep: number,
  maximumFraction: number,
  input: SimulationInput,
  accelerationField: ReturnType<typeof createAccelerationField>,
): TrajectoryPoint | null {
  if (state.velocity.y <= 0 || nextState.velocity.y > 0) return null;
  const denominator = state.velocity.y - nextState.velocity.y;
  if (Math.abs(denominator) <= EPSILON) return null;
  const fraction = state.velocity.y / denominator;
  if (fraction < 0 || fraction > maximumFraction) return null;
  return toTrajectoryPoint(
    partialStateAtFraction(state, timeStep, fraction, input, accelerationField),
  );
}

function partialStateAtFraction(
  state: KinematicState,
  timeStep: number,
  fraction: number,
  input: SimulationInput,
  accelerationField: ReturnType<typeof createAccelerationField>,
): KinematicState {
  if (fraction <= EPSILON)
    return { ...state, position: { ...state.position }, velocity: { ...state.velocity } };
  return integrateStep(input.integrator, state, timeStep * fraction, accelerationField);
}

function createResult(options: {
  input: SimulationInput;
  initialSpeed: number | null;
  status: SimulationStatus;
  terminationReason: SimulationTerminationReason;
  trajectory: TrajectoryPoint[] | null;
  finalState: TrajectoryPoint;
  apexPoint: TrajectoryPoint;
  impact: ImpactResult | null;
  closestApproach: ClosestTargetApproach | null;
  iterations: number;
  warnings: SimulationMessage[];
  errors: SimulationMessage[];
}): CoreSimulationResult {
  return {
    status: options.status,
    terminationReason: options.terminationReason,
    trajectory: options.trajectory,
    finalState: options.finalState,
    impact: options.impact,
    flightTimeSeconds: options.finalState.elapsedSeconds,
    horizontalRange: Math.abs(options.finalState.position.x - options.input.launchPosition.x),
    maximumHeight: options.apexPoint.position.y,
    apexPoint: options.apexPoint,
    closestApproach: options.closestApproach,
    iterations: options.iterations,
    warnings: options.warnings,
    errors: options.errors,
    parametersUsed: { input: options.input, initialSpeed: options.initialSpeed },
  };
}

function resolveProximityTargets(
  targets: readonly CircularTarget[],
  targetId: string | undefined,
): { targets: readonly CircularTarget[]; errors: SimulationMessage[] } {
  if (targetId === undefined) return { targets, errors: [] };
  const target = targets.find((candidate) => candidate.id === targetId);
  if (target) return { targets: [target], errors: [] };
  return {
    targets: [],
    errors: [
      {
        code: 'target-not-found',
        message: `No existe un objetivo configurado con id ${targetId}.`,
      },
    ],
  };
}

function closestApproachAtPoint(
  point: TrajectoryPoint,
  targets: readonly CircularTarget[],
): ClosestTargetApproach | null {
  let closest: ClosestTargetApproach | null = null;
  for (const target of targets) {
    const centerDistance = Math.hypot(
      point.position.x - target.center.x,
      point.position.y - target.center.y,
    );
    closest = nearerClosestApproach(closest, {
      targetId: target.id,
      point: { ...point.position },
      elapsedSeconds: point.elapsedSeconds,
      centerDistance,
      surfaceDistance: Math.max(0, centerDistance - target.radius),
      spatialTolerance: 0,
    });
  }
  return closest;
}

function toClosestTargetApproach(
  candidate: TrajectoryTargetApproachCandidate,
  stepStartSeconds: number,
  timeStepSeconds: number,
): ClosestTargetApproach {
  return {
    targetId: candidate.targetId,
    point: { ...candidate.point },
    elapsedSeconds: stepStartSeconds + candidate.fraction * timeStepSeconds,
    centerDistance: candidate.centerDistance,
    surfaceDistance: candidate.surfaceDistance,
    spatialTolerance: candidate.spatialTolerance,
  };
}

function nearerClosestApproach(
  left: ClosestTargetApproach | null,
  right: ClosestTargetApproach | null,
): ClosestTargetApproach | null {
  if (!left) return right;
  if (!right) return left;
  if (Math.abs(left.surfaceDistance - right.surfaceDistance) > EPSILON) {
    return right.surfaceDistance < left.surfaceDistance ? right : left;
  }
  if (Math.abs(left.centerDistance - right.centerDistance) > EPSILON) {
    return right.centerDistance < left.centerDistance ? right : left;
  }
  if (Math.abs(left.elapsedSeconds - right.elapsedSeconds) > EPSILON) {
    return right.elapsedSeconds < left.elapsedSeconds ? right : left;
  }
  return right.targetId < left.targetId ? right : left;
}

function collisionToImpact(candidate: CollisionCandidate, elapsedSeconds: number): ImpactResult {
  const base: ImpactResult = {
    kind: candidate.kind,
    point: candidate.point,
    elapsedSeconds,
    normal: candidate.normal,
  };
  if (candidate.targetId !== undefined) base.targetId = candidate.targetId;
  if (candidate.terrainSegmentIndex !== undefined) {
    base.terrainSegmentIndex = candidate.terrainSegmentIndex;
  }
  return base;
}

function impactReason(kind: CollisionCandidate['kind']): SimulationTerminationReason {
  if (kind === 'target') return 'target-impact';
  if (kind === 'terrain') return 'terrain-impact';
  return 'ground-impact';
}

function toTrajectoryPoint(state: KinematicState): TrajectoryPoint {
  return {
    position: { ...state.position },
    velocity: { ...state.velocity },
    elapsedSeconds: state.elapsedSeconds,
  };
}

function appendUniquePoint(trajectory: TrajectoryPoint[] | null, point: TrajectoryPoint) {
  if (!trajectory) return;
  const last = trajectory.at(-1);
  if (
    !last ||
    Math.abs(last.position.x - point.position.x) > EPSILON ||
    Math.abs(last.position.y - point.position.y) > EPSILON ||
    Math.abs(last.elapsedSeconds - point.elapsedSeconds) > EPSILON
  ) {
    trajectory.push(point);
  }
}

function higherPoint(left: TrajectoryPoint, right: TrajectoryPoint): TrajectoryPoint {
  return right.position.y > left.position.y ? right : left;
}

function kinematicStateIsFinite(state: KinematicState): boolean {
  return [
    state.position.x,
    state.position.y,
    state.velocity.x,
    state.velocity.y,
    state.elapsedSeconds,
  ].every(Number.isFinite);
}

function finiteVectorOrZero(vector: Vec2): Vec2 {
  return {
    x: Number.isFinite(vector.x) ? vector.x : 0,
    y: Number.isFinite(vector.y) ? vector.y : 0,
  };
}
