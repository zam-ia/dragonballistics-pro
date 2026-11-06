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
