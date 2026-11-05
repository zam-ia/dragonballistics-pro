import type { Vec2 } from '@dragonballistics/shared';
import { findBoundsExit, findFirstCollision } from './collisions';
import { createAccelerationField } from './forces';
import { integrateStep } from './integrators';
import { powerToInitialSpeed } from './power';
import type {
  CollisionCandidate,
  ImpactResult,
  KinematicState,
  SimulationInput,
  SimulationMessage,
  SimulationResult,
  SimulationStatus,
  SimulationTerminationReason,
  TrajectoryPoint,
} from './types';
import { validateSimulationInput } from './validation';
import { degreesToRadians } from './wind';

const EPSILON = 1e-10;

export function simulateProjectile(input: SimulationInput): SimulationResult {
  const validation = validateSimulationInput(input);
  const safeLaunch = finiteVectorOrZero(input.launchPosition);
  const emptyPoint: TrajectoryPoint = {
    position: safeLaunch,
    velocity: { x: 0, y: 0 },
    elapsedSeconds: 0,
  };
  if (validation.errors.length > 0) {
    return createResult({
      input,
      initialSpeed: null,
      status: 'invalid',
      terminationReason: 'invalid-input',
      trajectory: [emptyPoint],
      finalState: emptyPoint,
      apexPoint: emptyPoint,
      impact: null,
      iterations: 0,
      warnings: validation.warnings,
      errors: validation.errors,
    });
  }

  const initialSpeed = powerToInitialSpeed(input.power, input.powerModel);
  if (!Number.isFinite(initialSpeed)) {
    return createResult({
      input,
      initialSpeed: null,
      status: 'invalid',
      terminationReason: 'invalid-input',
      trajectory: [emptyPoint],
      finalState: emptyPoint,
      apexPoint: emptyPoint,
      impact: null,
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
  let apexPoint = toTrajectoryPoint(state);
  const trajectory: TrajectoryPoint[] = [toTrajectoryPoint(state)];
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
      finalState: trajectory[0] ?? emptyPoint,
      apexPoint,
      impact,
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
      finalState: trajectory[0] ?? emptyPoint,
      apexPoint,
      impact,
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
        iterations: iteration,
        warnings: validation.warnings,
        errors: [
          { code: 'invalid-numeric-state', message: 'El integrador produjo un estado no finito.' },
        ],
      });
    }

    const collision = findFirstCollision(state.position, nextState.position, input.collisions);
    const boundsExit = findBoundsExit(state.position, nextState.position, input.bounds);
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
      const finalState = partialStateAtFraction(
        state,
        timeStep,
        collision.fraction,
        input,
        accelerationField,
      );
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
        iterations: iteration,
        warnings: validation.warnings,
        errors: [],
      });
    }

    if (boundsExit) {
      const finalState = partialStateAtFraction(
        state,
        timeStep,
        boundsExit.fraction,
        input,
        accelerationField,
      );
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
        iterations: iteration,
        warnings: validation.warnings,
        errors: [],
      });
    }

    state = nextState;
    const nextPoint = toTrajectoryPoint(state);
    trajectory.push(nextPoint);
    apexPoint = higherPoint(apexPoint, nextPoint);
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
  trajectory: TrajectoryPoint[];
  finalState: TrajectoryPoint;
  apexPoint: TrajectoryPoint;
  impact: ImpactResult | null;
  iterations: number;
  warnings: SimulationMessage[];
  errors: SimulationMessage[];
}): SimulationResult {
  return {
    status: options.status,
    terminationReason: options.terminationReason,
    trajectory: options.trajectory,
    finalPosition: options.finalState.position,
    impact: options.impact,
    flightTimeSeconds: options.finalState.elapsedSeconds,
    horizontalRange: Math.abs(options.finalState.position.x - options.input.launchPosition.x),
    maximumHeight: options.apexPoint.position.y,
    apexPoint: options.apexPoint,
    iterations: options.iterations,
    warnings: options.warnings,
    errors: options.errors,
    parametersUsed: { input: options.input, initialSpeed: options.initialSpeed },
  };
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

function appendUniquePoint(trajectory: TrajectoryPoint[], point: TrajectoryPoint) {
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
