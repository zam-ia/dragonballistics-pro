import { describe, expect, it } from 'vitest';
import {
  directionDegrees,
  euclideanDistance,
  horizontalDistance,
  screenToWorld,
  vectorBetween,
  worldToScreen,
} from './geometry';

describe('geometry foundations', () => {
  it('computes a known 3-4-5 triangle without rounding', () => {
    const from = { x: 2, y: 3 };
    const to = { x: 5, y: 7 };

    expect(vectorBetween(from, to)).toEqual({ x: 3, y: 4 });
    expect(euclideanDistance(from, to)).toBe(5);
    expect(horizontalDistance(from, to)).toBe(3);
  });

  it('uses positive world Y upwards', () => {
    expect(directionDegrees({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45, 12);
  });

  it('round-trips between world and screen coordinates', () => {
    const transform = {
      origin: { x: 20, y: 30 },
      pixelsPerUnit: 2,
      heightPixels: 600,
    };
    const world = { x: 150.25, y: 85.5 };

    expect(screenToWorld(worldToScreen(world, transform), transform)).toEqual(world);
  });
});
