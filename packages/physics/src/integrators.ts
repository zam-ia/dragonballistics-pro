import type { AccelerationField, IntegratorKind, KinematicState } from './types';

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
  const halfStep = timeStepSeconds * 0.5;
  const acceleration1 = accelerationField(state);
  const state2: KinematicState = {
    position: {
      x: state.position.x + state.velocity.x * halfStep,
      y: state.position.y + state.velocity.y * halfStep,
    },
    velocity: {
      x: state.velocity.x + acceleration1.x * halfStep,
      y: state.velocity.y + acceleration1.y * halfStep,
    },
    elapsedSeconds: state.elapsedSeconds + halfStep,
  };
  const acceleration2 = accelerationField(state2);
  const state3: KinematicState = {
    position: {
      x: state.position.x + state2.velocity.x * halfStep,
      y: state.position.y + state2.velocity.y * halfStep,
    },
    velocity: {
      x: state.velocity.x + acceleration2.x * halfStep,
      y: state.velocity.y + acceleration2.y * halfStep,
    },
    elapsedSeconds: state.elapsedSeconds + halfStep,
  };
  const acceleration3 = accelerationField(state3);
  const state4: KinematicState = {
    position: {
      x: state.position.x + state3.velocity.x * timeStepSeconds,
      y: state.position.y + state3.velocity.y * timeStepSeconds,
    },
    velocity: {
      x: state.velocity.x + acceleration3.x * timeStepSeconds,
      y: state.velocity.y + acceleration3.y * timeStepSeconds,
    },
    elapsedSeconds: state.elapsedSeconds + timeStepSeconds,
  };
  const acceleration4 = accelerationField(state4);
  const scale = timeStepSeconds / 6;

  return {
    position: {
      x:
        state.position.x +
        scale *
          (state.velocity.x + 2 * state2.velocity.x + 2 * state3.velocity.x + state4.velocity.x),
      y:
        state.position.y +
        scale *
          (state.velocity.y + 2 * state2.velocity.y + 2 * state3.velocity.y + state4.velocity.y),
    },
    velocity: {
      x:
        state.velocity.x +
        scale * (acceleration1.x + 2 * acceleration2.x + 2 * acceleration3.x + acceleration4.x),
      y:
        state.velocity.y +
        scale * (acceleration1.y + 2 * acceleration2.y + 2 * acceleration3.y + acceleration4.y),
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
