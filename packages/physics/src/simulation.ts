import type { Vec2 } from '@dragonballistics/shared';
import {
  findFirstCollision,
  findFirstTrajectoryEvent,
  findInitialTerrainCollision,
} from './collisions';
import type { TrajectoryTargetApproachCandidate } from './collisions';
import { createAccelerationField } from './forces';
import { integrateStep } from './integrators';
import { evaluateQuarticBernstein, quarticBernsteinControlsFromSamples } from './polynomial-path';
import { powerToInitialSpeed } from './power';
import type {
  CollisionCandidate,
  CircularTarget,
  ClosestTargetApproach,
  ImpactResult,
  KinematicState,
  ProfiledSimulationEvaluation,
  SimulationInput,
  SimulationMessage,
  SimulationPerformanceMetrics,
  SimulationProfileOptions,
  SimulationResult,
  SimulationSummary,
  SimulationStatus,
  SummaryEvaluationOptions,
  SimulationTerminationReason,
  TrajectorySamplingPolicy,
  TrajectoryPoint,
} from './types';
import { validateSimulationInput } from './validation';
import { degreesToRadians } from './wind';

const EPSILON = 1e-10;

export function simulateProjectile(input: SimulationInput): SimulationResult {
  return toSimulationResult(
    runSimulation(input, {
      captureTrajectory: true,
      proximityTargets: [],
      additionalErrors: [],
      samplingPolicy: 'polynomial-safe',
      metrics: null,
    }),
  );
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
    samplingPolicy: 'polynomial-safe',
    metrics: null,
  });
  return toSimulationSummary(result);
}

export function profileProjectileEvaluation(
  input: SimulationInput,
  options: SimulationProfileOptions,
): ProfiledSimulationEvaluation {
  const metrics = options.collectMetrics === false ? null : createPerformanceMetrics();
  const selection =
    options.mode === 'summary'
      ? resolveProximityTargets(input.collisions.targets, options.targetId)
      : { targets: [], errors: [] };
  const result = runSimulation(input, {
    captureTrajectory: options.mode === 'full',
    proximityTargets: selection.targets,
    additionalErrors: selection.errors,
    samplingPolicy: options.samplingPolicy,
    metrics,
  });
  const publicResult =
    options.mode === 'full' ? toSimulationResult(result) : toSimulationSummary(result);
  if (metrics) {
    metrics.retainedTrajectoryPoints =
      'trajectory' in publicResult ? publicResult.trajectory.length : 0;
  }
  return { result: publicResult, metrics };
}

interface RunOptions {
  captureTrajectory: boolean;
  proximityTargets: readonly CircularTarget[];
  additionalErrors: SimulationMessage[];
  samplingPolicy: TrajectorySamplingPolicy;
  metrics: SimulationPerformanceMetrics | null;
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
    const nextState = integrateForRun(
      input.integrator,
      state,
      timeStep,
      accelerationField,
      'main',
      options.metrics,
    );
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
      if (options.metrics) options.metrics.stateAtFractionCalls += 1;
      const cached = stateCache.get(fraction);
      if (cached) {
        if (options.metrics) options.metrics.stateCacheHits += 1;
        return cached;
      }
      if (options.metrics) options.metrics.stateCacheMisses += 1;
      const partial = partialStateAtFraction(
        state,
        timeStep,
        fraction,
        input,
        accelerationField,
        options.metrics,
      );
      stateCache.set(fraction, partial);
      if (options.metrics) {
        options.metrics.peakStateCacheEntries = Math.max(
          options.metrics.peakStateCacheEntries,
          stateCache.size,
        );
      }
      return partial;
    };
    const positionAtFraction =
      options.samplingPolicy === 'polynomial-safe'
        ? createPolynomialPositionEvaluator(state, nextState, stateAtFraction, options.metrics)
        : (fraction: number) => stateAtFraction(fraction).position;
    const collisionStart = options.metrics ? performance.now() : 0;
    const {
      collision,
      boundsExit,
      closestApproach: stepClosestApproach,
    } = findFirstTrajectoryEvent(positionAtFraction, input.collisions, input.bounds, {
      proximityTargets: options.proximityTargets,
      samplingPolicy: options.samplingPolicy,
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    if (options.metrics) {
      options.metrics.collisionMilliseconds += performance.now() - collisionStart;
    }
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
      options.metrics,
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
  metrics: SimulationPerformanceMetrics | null,
): TrajectoryPoint | null {
  if (state.velocity.y <= 0 || nextState.velocity.y > 0) return null;
  const denominator = state.velocity.y - nextState.velocity.y;
  if (Math.abs(denominator) <= EPSILON) return null;
  const fraction = state.velocity.y / denominator;
  if (fraction < 0 || fraction > maximumFraction) return null;
  return toTrajectoryPoint(
    partialStateAtFraction(state, timeStep, fraction, input, accelerationField, metrics),
  );
}

function partialStateAtFraction(
  state: KinematicState,
  timeStep: number,
  fraction: number,
  input: SimulationInput,
  accelerationField: ReturnType<typeof createAccelerationField>,
  metrics: SimulationPerformanceMetrics | null,
): KinematicState {
  if (fraction <= EPSILON)
    return { ...state, position: { ...state.position }, velocity: { ...state.velocity } };
  return integrateForRun(
    input.integrator,
    state,
    timeStep * fraction,
    accelerationField,
    'partial',
    metrics,
  );
}

function integrateForRun(
  integrator: SimulationInput['integrator'],
  state: Readonly<KinematicState>,
  timeStepSeconds: number,
  accelerationField: ReturnType<typeof createAccelerationField>,
  category: 'main' | 'partial',
  metrics: SimulationPerformanceMetrics | null,
): KinematicState {
  const start = metrics ? performance.now() : 0;
  const result = integrateStep(integrator, state, timeStepSeconds, accelerationField);
  if (metrics) {
    metrics.integrationMilliseconds += performance.now() - start;
    if (category === 'main') {
      metrics.mainIntegrationCalls += 1;
      if (integrator === 'rk4') metrics.rk4MainEvaluations += 1;
    } else {
      metrics.partialIntegrationCalls += 1;
      if (integrator === 'rk4') metrics.rk4PartialEvaluations += 1;
    }
    metrics.approximateIntegratedStateObjects += integrator === 'rk4' ? 4 : 1;
  }
  return result;
}

function createPolynomialPositionEvaluator(
  state: KinematicState,
  nextState: KinematicState,
  stateAtFraction: (fraction: number) => KinematicState,
  metrics: SimulationPerformanceMetrics | null,
): (fraction: number) => Vec2 {
  const quarter = stateAtFraction(0.25).position;
  const middle = stateAtFraction(0.5).position;
  const threeQuarter = stateAtFraction(0.75).position;
  let controls: ReturnType<typeof quarticBernsteinControlsFromSamples> | null = null;
  if (metrics) metrics.polynomialSamplersCreated += 1;

  return (fraction: number) => {
    if (metrics) metrics.polynomialPositionEvaluations += 1;
    if (fraction <= EPSILON) return state.position;
    if (fraction >= 1 - EPSILON) return nextState.position;
    if (fraction === 0.25) return quarter;
    if (fraction === 0.5) return middle;
    if (fraction === 0.75) return threeQuarter;
    if (!controls) {
      controls = quarticBernsteinControlsFromSamples(
        state.position,
        quarter,
        middle,
        threeQuarter,
        nextState.position,
      );
      if (metrics) metrics.polynomialControlSetsCreated += 1;
    }
    return evaluateQuarticBernstein(controls, fraction);
  };
}

function toSimulationResult(result: CoreSimulationResult): SimulationResult {
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

function toSimulationSummary(result: CoreSimulationResult): SimulationSummary {
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

function createPerformanceMetrics(): SimulationPerformanceMetrics {
  return {
    mainIntegrationCalls: 0,
    partialIntegrationCalls: 0,
    rk4MainEvaluations: 0,
    rk4PartialEvaluations: 0,
    stateAtFractionCalls: 0,
    stateCacheHits: 0,
    stateCacheMisses: 0,
    peakStateCacheEntries: 0,
    polynomialSamplersCreated: 0,
    polynomialControlSetsCreated: 0,
    polynomialPositionEvaluations: 0,
    conservativeGeometryAcceptances: 0,
    conservativeGeometryFallbacks: 0,
    trajectoryEventCalls: 0,
    flattenIntervalCalls: 0,
    flattenSubdivisions: 0,
    acceptedLeaves: 0,
    closestApproachSegments: 0,
    integrationMilliseconds: 0,
    collisionMilliseconds: 0,
    closestApproachMilliseconds: 0,
    retainedTrajectoryPoints: 0,
    approximateIntegratedStateObjects: 0,
  };
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
