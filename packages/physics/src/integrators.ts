import type { Vec2 } from '@dragonballistics/shared';
import type { AccelerationField, IntegratorKind, KinematicState } from './types';

interface StateDerivative {
  position: Vec2;
  velocity: Vec2;
}

export function semiImplicitEulerStep(
  state: Readonly<KinematicState>,
  timeStepSeconds: number,
  accelerationField: AccelerationField,
): KinematicState {
  const acceleration = accelerationField(state);
  const velocity = {
    x: state.velocity.x + acceleration.x * timeStepSeconds,
    y: state.velocity.y + acceleration.y * timeStepSeconds,
  };
  return {
    position: {
      x: state.position.x + velocity.x * timeStepSeconds,
      y: state.position.y + velocity.y * timeStepSeconds,
    },
    velocity,
    elapsedSeconds: state.elapsedSeconds + timeStepSeconds,
  };
}

export function rungeKutta4Step(
  state: Readonly<KinematicState>,
  timeStepSeconds: number,
  accelerationField: AccelerationField,
): KinematicState {
  const k1 = derivative(state, accelerationField);
  const k2State = addDerivative(state, k1, timeStepSeconds * 0.5);
  const k2 = derivative(k2State, accelerationField);
  const k3State = addDerivative(state, k2, timeStepSeconds * 0.5);
  const k3 = derivative(k3State, accelerationField);
  const k4State = addDerivative(state, k3, timeStepSeconds);
  const k4 = derivative(k4State, accelerationField);
  const scale = timeStepSeconds / 6;

  return {
    position: {
      x:
        state.position.x +
        scale * (k1.position.x + 2 * k2.position.x + 2 * k3.position.x + k4.position.x),
      y:
        state.position.y +
        scale * (k1.position.y + 2 * k2.position.y + 2 * k3.position.y + k4.position.y),
    },
    velocity: {
      x:
        state.velocity.x +
        scale * (k1.velocity.x + 2 * k2.velocity.x + 2 * k3.velocity.x + k4.velocity.x),
      y:
        state.velocity.y +
        scale * (k1.velocity.y + 2 * k2.velocity.y + 2 * k3.velocity.y + k4.velocity.y),
    },
    elapsedSeconds: state.elapsedSeconds + timeStepSeconds,
  };
}

export function integrateStep(
  kind: IntegratorKind,
  state: Readonly<KinematicState>,
  timeStepSeconds: number,
  accelerationField: AccelerationField,
): KinematicState {
  return kind === 'rk4'
    ? rungeKutta4Step(state, timeStepSeconds, accelerationField)
    : semiImplicitEulerStep(state, timeStepSeconds, accelerationField);
}

function derivative(
  state: Readonly<KinematicState>,
  accelerationField: AccelerationField,
): StateDerivative {
  return {
    position: state.velocity,
    velocity: accelerationField(state),
  };
}

function addDerivative(
  state: Readonly<KinematicState>,
  derivativeValue: StateDerivative,
  scale: number,
): KinematicState {
  return {
    position: {
      x: state.position.x + derivativeValue.position.x * scale,
      y: state.position.y + derivativeValue.position.y * scale,
    },
    velocity: {
      x: state.velocity.x + derivativeValue.velocity.x * scale,
      y: state.velocity.y + derivativeValue.velocity.y * scale,
    },
    elapsedSeconds: state.elapsedSeconds + scale,
  };
}
