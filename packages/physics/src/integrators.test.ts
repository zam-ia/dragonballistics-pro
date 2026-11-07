import { describe, expect, it } from 'vitest';
import { analyticalStateAt } from './analytic';
import { rungeKutta4Step, semiImplicitEulerStep } from './integrators';
import type { AccelerationField, KinematicState } from './types';

const initialState: KinematicState = {
  position: { x: 3, y: 5 },
  velocity: { x: 10, y: 12 },
  elapsedSeconds: 0,
};
const acceleration = { x: 2, y: -9.81 };
const field: AccelerationField = () => acceleration;

describe('numeric integrators', () => {
  it('RK4 matches the analytical constant-acceleration state', () => {
    const actual = rungeKutta4Step(initialState, 2, field);
    const expected = analyticalStateAt(initialState, acceleration, 2);

    expect(actual.position.x).toBeCloseTo(expected.position.x, 12);
    expect(actual.position.y).toBeCloseTo(expected.position.y, 12);
    expect(actual.velocity.x).toBeCloseTo(expected.velocity.x, 12);
    expect(actual.velocity.y).toBeCloseTo(expected.velocity.y, 12);
  });

  it('semi-implicit Euler updates velocity before position', () => {
    const actual = semiImplicitEulerStep(initialState, 0.5, field);

    expect(actual.velocity).toEqual({ x: 11, y: 7.095 });
    expect(actual.position.x).toBe(8.5);
    expect(actual.position.y).toBeCloseTo(8.5475, 12);
  });

  it('optimized RK4 matches the allocation-heavy reference for a state-dependent field', () => {
    const nonlinearField: AccelerationField = (state) => ({
      x: state.position.x * 0.03 - state.velocity.x * 0.2,
      y: Math.sin(state.position.y) * 0.1 - state.velocity.y * 0.15,
    });
    const actual = rungeKutta4Step(initialState, 0.125, nonlinearField);
    const expected = referenceRk4Step(initialState, 0.125, nonlinearField);

    expect(actual.position.x).toBeCloseTo(expected.position.x, 14);
    expect(actual.position.y).toBeCloseTo(expected.position.y, 14);
    expect(actual.velocity.x).toBeCloseTo(expected.velocity.x, 14);
    expect(actual.velocity.y).toBeCloseTo(expected.velocity.y, 14);
    expect(actual.elapsedSeconds).toBe(expected.elapsedSeconds);
  });

  it('Euler converges toward the analytical position when the step is reduced', () => {
    function integrate(step: number) {
      let state = initialState;
      const count = Math.round(2 / step);
      for (let index = 0; index < count; index += 1) {
        state = semiImplicitEulerStep(state, step, field);
      }
      return state;
    }

    const expected = analyticalStateAt(initialState, acceleration, 2);
    const coarseError = Math.abs(integrate(0.2).position.y - expected.position.y);
    const fineError = Math.abs(integrate(0.05).position.y - expected.position.y);

    expect(fineError).toBeLessThan(coarseError * 0.3);
  });
});

function referenceRk4Step(
  state: Readonly<KinematicState>,
  step: number,
  accelerationField: AccelerationField,
): KinematicState {
  const derivative = (value: Readonly<KinematicState>) => ({
    position: value.velocity,
    velocity: accelerationField(value),
  });
  const add = (
    value: Readonly<KinematicState>,
    change: ReturnType<typeof derivative>,
    scale: number,
  ): KinematicState => ({
    position: {
      x: value.position.x + change.position.x * scale,
      y: value.position.y + change.position.y * scale,
    },
    velocity: {
      x: value.velocity.x + change.velocity.x * scale,
      y: value.velocity.y + change.velocity.y * scale,
    },
    elapsedSeconds: value.elapsedSeconds + scale,
  });
  const first = derivative(state);
  const second = derivative(add(state, first, step * 0.5));
  const third = derivative(add(state, second, step * 0.5));
  const fourth = derivative(add(state, third, step));
  const scale = step / 6;
  return {
    position: {
      x:
        state.position.x +
        scale *
          (first.position.x + 2 * second.position.x + 2 * third.position.x + fourth.position.x),
      y:
        state.position.y +
        scale *
          (first.position.y + 2 * second.position.y + 2 * third.position.y + fourth.position.y),
    },
    velocity: {
      x:
        state.velocity.x +
        scale *
          (first.velocity.x + 2 * second.velocity.x + 2 * third.velocity.x + fourth.velocity.x),
      y:
        state.velocity.y +
        scale *
          (first.velocity.y + 2 * second.velocity.y + 2 * third.velocity.y + fourth.velocity.y),
    },
    elapsedSeconds: state.elapsedSeconds + step,
  };
}
