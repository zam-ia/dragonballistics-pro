import { describe, expect, it } from 'vitest';
import { findBoundsExit, findFirstCollision } from './collisions';

describe('continuous collision checks', () => {
  it('interpolates a horizontal-ground contact between steps', () => {
    const collision = findFirstCollision(
      { x: 2, y: 3 },
      { x: 8, y: -1 },
      { groundY: 0, terrain: [], targets: [] },
    );

    expect(collision?.kind).toBe('ground');
    expect(collision?.fraction).toBeCloseTo(0.75, 12);
    expect(collision?.point).toEqual({ x: 6.5, y: 0 });
  });

  it('detects terrain segments and reports the first segment index', () => {
    const collision = findFirstCollision(
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      {
        terrain: [
          { start: { x: 8, y: 0 }, end: { x: 8, y: 10 } },
          { start: { x: 5, y: 0 }, end: { x: 5, y: 10 } },
        ],
        targets: [],
      },
    );

    expect(collision?.kind).toBe('terrain');
    expect(collision?.terrainSegmentIndex).toBe(1);
    expect(collision?.point.x).toBeCloseTo(5, 12);
  });

  it('detects a circular target before a later terrain surface', () => {
    const collision = findFirstCollision(
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      {
        terrain: [{ start: { x: 8, y: 0 }, end: { x: 8, y: 10 } }],
        targets: [{ id: 'target', center: { x: 4, y: 5 }, radius: 1 }],
      },
    );

    expect(collision?.kind).toBe('target');
    expect(collision?.targetId).toBe('target');
    expect(collision?.point.x).toBeCloseTo(3, 12);
  });

  it('interpolates the first world-boundary exit', () => {
    const exit = findBoundsExit(
      { x: 5, y: 5 },
      { x: 15, y: 20 },
      { minimumX: 0, maximumX: 10, minimumY: 0, maximumY: 12 },
    );

    expect(exit?.fraction).toBeCloseTo(7 / 15, 12);
    expect(exit?.point.y).toBeCloseTo(12, 12);
  });
});
