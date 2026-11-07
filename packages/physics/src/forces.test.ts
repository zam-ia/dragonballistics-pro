import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccelerationField } from './forces';
import { windAccelerationAt } from './wind';
import type { KinematicState, SimulationEnvironment } from './types';

const state: KinematicState = {
  position: { x: 4, y: 8 },
  velocity: { x: 10, y: -2 },
  elapsedSeconds: 0.5,
};

afterEach(() => vi.restoreAllMocks());

describe('acceleration field specialization', () => {
  it('precomputes polar trigonometry instead of repeating it per derivative', () => {
    const cosine = vi.spyOn(Math, 'cos');
    const sine = vi.spyOn(Math, 'sin');
    const environment: SimulationEnvironment = {
      gravity: 9.81,
      additionalAcceleration: { x: 0.2, y: 0.4 },
      wind: { kind: 'acceleration', magnitude: 3, directionDegrees: 120 },
    };
    const field = createAccelerationField(environment);
    const cosineCallsAfterCreation = cosine.mock.calls.length;
    const sineCallsAfterCreation = sine.mock.calls.length;

    for (let index = 0; index < 20; index += 1) field(state);

    expect(cosineCallsAfterCreation).toBeGreaterThan(0);
    expect(sineCallsAfterCreation).toBeGreaterThan(0);
    expect(cosine).toHaveBeenCalledTimes(cosineCallsAfterCreation);
    expect(sine).toHaveBeenCalledTimes(sineCallsAfterCreation);
  });

  it('preserves acceleration and linear-drag equations after precomputation', () => {
    for (const environment of [
      {
        gravity: 9.81,
        additionalAcceleration: { x: 0.2, y: 0.4 },
        wind: { kind: 'acceleration', magnitude: 3, directionDegrees: 120 } as const,
      },
      {
        gravity: 9.81,
        additionalAcceleration: { x: 0.2, y: 0.4 },
        wind: {
          kind: 'linear-drag',
          magnitude: 20,
          directionDegrees: 15,
          dragCoefficientPerSecond: 0.5,
        } as const,
      },
    ] satisfies SimulationEnvironment[]) {
      const expectedWind = windAccelerationAt(environment.wind, state);
      const actual = createAccelerationField(environment)(state);

      expect(actual.x).toBeCloseTo(environment.additionalAcceleration.x + expectedWind.x, 14);
      expect(actual.y).toBeCloseTo(
        environment.additionalAcceleration.y - environment.gravity + expectedWind.y,
        14,
      );
    }
  });
});
