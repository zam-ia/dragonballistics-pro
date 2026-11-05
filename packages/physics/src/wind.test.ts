import { describe, expect, it } from 'vitest';
import { polarVector, windAccelerationAt } from './wind';
import type { KinematicState } from './types';

const state: KinematicState = {
  position: { x: 0, y: 0 },
  velocity: { x: 10, y: -2 },
  elapsedSeconds: 0,
};

describe('wind models', () => {
  it('decomposes magnitude using +X at 0 degrees and +Y at 90 degrees', () => {
    expect(polarVector(8, 0)).toEqual({ x: 8, y: 0 });
    expect(polarVector(8, 90).x).toBeCloseTo(0, 12);
    expect(polarVector(8, 90).y).toBeCloseTo(8, 12);
    expect(polarVector(8, 180).x).toBeCloseTo(-8, 12);
  });

  it('treats acceleration wind as a direct acceleration vector', () => {
    const acceleration = windAccelerationAt(
      { kind: 'acceleration', magnitude: 3, directionDegrees: 270 },
      state,
    );

    expect(acceleration.x).toBeCloseTo(0, 12);
    expect(acceleration.y).toBeCloseTo(-3, 12);
  });

  it('linear drag accelerates velocity toward the configured air velocity', () => {
    const acceleration = windAccelerationAt(
      {
        kind: 'linear-drag',
        magnitude: 20,
        directionDegrees: 0,
        dragCoefficientPerSecond: 0.5,
      },
      state,
    );

    expect(acceleration).toEqual({ x: 5, y: 1 });
  });
});
