import { describe, expect, it } from 'vitest';
import { analyticalStateAt } from './analytic';
import { createDefaultSimulationInput } from './defaults';
import { simulateProjectile } from './simulation';
import type { SimulationInput } from './types';

function inputWithoutObstacles(overrides: Partial<SimulationInput> = {}): SimulationInput {
  const base = createDefaultSimulationInput({ x: 0, y: 0 }, { x: 900, y: 900 });
  return {
    ...base,
    bounds: { minimumX: -2_000, maximumX: 2_000, minimumY: -2_000, maximumY: 2_000 },
    collisions: { terrain: [], targets: [] },
    ...overrides,
  };
}

describe('projectile simulation', () => {
  it('matches an analytical no-wind constant-gravity state', () => {
    const input = inputWithoutObstacles({
      launchPosition: { x: 2, y: 10 },
      launchAngleDegrees: 35,
      power: 30,
      maximumTimeSeconds: 2,
      timeStepSeconds: 0.02,
    });
    const result = simulateProjectile(input);
    const speed = result.parametersUsed.initialSpeed ?? 0;
    const expected = analyticalStateAt(
      {
        position: input.launchPosition,
        velocity: {
          x: speed * Math.cos((35 * Math.PI) / 180),
          y: speed * Math.sin((35 * Math.PI) / 180),
        },
        elapsedSeconds: 0,
      },
      { x: 0, y: -9.81 },
      2,
    );

    expect(result.terminationReason).toBe('maximum-time');
    expect(result.finalPosition.x).toBeCloseTo(expected.position.x, 9);
    expect(result.finalPosition.y).toBeCloseTo(expected.position.y, 9);
  });

  it('produces complementary-angle ranges and distinct apex heights', () => {
    const base = inputWithoutObstacles({
      power: 40,
      collisions: { groundY: 0, terrain: [], targets: [] },
    });
    const low = simulateProjectile({ ...base, launchAngleDegrees: 30 });
    const high = simulateProjectile({ ...base, launchAngleDegrees: 60 });

    expect(low.terminationReason).toBe('ground-impact');
    expect(high.terminationReason).toBe('ground-impact');
    expect(low.horizontalRange).toBeCloseTo(high.horizontalRange, 1);
    expect(high.maximumHeight).toBeGreaterThan(low.maximumHeight * 2.5);
  });

  it('horizontal positive and negative wind change range with the correct sign', () => {
    const base = inputWithoutObstacles({
      power: 35,
      launchAngleDegrees: 45,
      collisions: { groundY: 0, terrain: [], targets: [] },
    });
    const calm = simulateProjectile(base);
    const positive = simulateProjectile({
      ...base,
      environment: {
        ...base.environment,
        wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 0 },
      },
    });
    const negative = simulateProjectile({
      ...base,
      environment: {
        ...base.environment,
        wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 180 },
      },
    });

    expect(positive.horizontalRange).toBeGreaterThan(calm.horizontalRange);
    expect(negative.horizontalRange).toBeLessThan(calm.horizontalRange);
  });

  it('upward wind increases flight time and apex height', () => {
    const base = inputWithoutObstacles({
      power: 30,
      launchAngleDegrees: 50,
      collisions: { groundY: 0, terrain: [], targets: [] },
    });
    const calm = simulateProjectile(base);
    const upward = simulateProjectile({
      ...base,
      environment: {
        ...base.environment,
        wind: { kind: 'acceleration', magnitude: 2, directionDegrees: 90 },
      },
    });

    expect(upward.flightTimeSeconds).toBeGreaterThan(calm.flightTimeSeconds);
    expect(upward.maximumHeight).toBeGreaterThan(calm.maximumHeight);
  });

  it('a higher launch position extends time before ground impact', () => {
    const base = inputWithoutObstacles({
      power: 25,
      launchAngleDegrees: 40,
      collisions: { groundY: 0, terrain: [], targets: [] },
    });
    const low = simulateProjectile(base);
    const high = simulateProjectile({ ...base, launchPosition: { x: 0, y: 40 } });

    expect(high.flightTimeSeconds).toBeGreaterThan(low.flightTimeSeconds);
    expect(high.horizontalRange).toBeGreaterThan(low.horizontalRange);
  });

  it('returns an interpolated ground impact exactly on the ground', () => {
    const result = simulateProjectile(
      inputWithoutObstacles({
        launchPosition: { x: 0, y: 12 },
        power: 24,
        launchAngleDegrees: 25,
        timeStepSeconds: 0.1,
        collisions: { groundY: 0, terrain: [], targets: [] },
      }),
    );

    expect(result.terminationReason).toBe('ground-impact');
    expect(result.impact?.point.y).toBe(0);
    expect(result.finalPosition.y).toBe(0);
  });

  it('detects a circular target along the trajectory', () => {
    const center = { x: 20 * Math.SQRT1_2, y: 20 * Math.SQRT1_2 - 4.905 };
    const input = inputWithoutObstacles({
      power: 20,
      launchAngleDegrees: 45,
      timeStepSeconds: 0.02,
      collisions: {
        groundY: 0,
        terrain: [],
        targets: [{ id: 'known-target', center, radius: 0.6 }],
      },
    });
    const result = simulateProjectile(input);

    expect(result.terminationReason).toBe('target-impact');
    expect(result.impact?.targetId).toBe('known-target');
    expect(result.flightTimeSeconds).toBeCloseTo(1, 1);
  });

  it('handles zero power as an immediate ground contact', () => {
    const result = simulateProjectile(
      inputWithoutObstacles({
        power: 0,
        collisions: { groundY: 0, terrain: [], targets: [] },
      }),
    );

    expect(result.status).toBe('completed');
    expect(result.terminationReason).toBe('ground-impact');
    expect(result.flightTimeSeconds).toBe(0);
  });

  it('handles zero gravity without fabricating an impact', () => {
    const input = inputWithoutObstacles({
      power: 10,
      launchAngleDegrees: 30,
      environment: {
        gravity: 0,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'none' },
      },
      maximumTimeSeconds: 1,
    });
    const result = simulateProjectile(input);

    expect(result.terminationReason).toBe('maximum-time');
    expect(result.impact).toBeNull();
    expect(result.finalPosition.y).toBeCloseTo(5, 10);
    expect(result.warnings.some((warning) => warning.code === 'zero-gravity')).toBe(true);
  });

  it('rejects invalid and non-finite parameters', () => {
    const invalidTimeStep = simulateProjectile(inputWithoutObstacles({ timeStepSeconds: 0 }));
    const invalidGravity = simulateProjectile(
      inputWithoutObstacles({
        environment: {
          gravity: Number.NaN,
          additionalAcceleration: { x: 0, y: 0 },
          wind: { kind: 'none' },
        },
      }),
    );

    expect(invalidTimeStep.terminationReason).toBe('invalid-input');
    expect(invalidGravity.terminationReason).toBe('invalid-input');
  });

  it('stops safely at the configured iteration limit', () => {
    const result = simulateProjectile(
      inputWithoutObstacles({
        maximumIterations: 2,
        maximumTimeSeconds: 10,
        timeStepSeconds: 0.1,
      }),
    );

    expect(result.terminationReason).toBe('maximum-iterations');
    expect(result.iterations).toBe(2);
    expect(result.trajectory).toHaveLength(3);
  });

  it('RK4 is more accurate than Euler for a constant-acceleration position', () => {
    const base = inputWithoutObstacles({
      launchPosition: { x: 0, y: 10 },
      power: 20,
      launchAngleDegrees: 70,
      maximumTimeSeconds: 2,
      timeStepSeconds: 0.2,
    });
    const rk4 = simulateProjectile({ ...base, integrator: 'rk4' });
    const euler = simulateProjectile({ ...base, integrator: 'semi-implicit-euler' });
    const speed = rk4.parametersUsed.initialSpeed ?? 0;
    const expected = analyticalStateAt(
      {
        position: base.launchPosition,
        velocity: {
          x: speed * Math.cos((70 * Math.PI) / 180),
          y: speed * Math.sin((70 * Math.PI) / 180),
        },
        elapsedSeconds: 0,
      },
      { x: 0, y: -9.81 },
      2,
    );
    const rk4Error = Math.abs(rk4.finalPosition.y - expected.position.y);
    const eulerError = Math.abs(euler.finalPosition.y - expected.position.y);

    expect(rk4Error).toBeLessThan(1e-9);
    expect(eulerError).toBeGreaterThan(1);
  });

  it('Euler simulation converges when reducing the time step', () => {
    const base = inputWithoutObstacles({
      launchPosition: { x: 0, y: 10 },
      power: 20,
      launchAngleDegrees: 70,
      maximumTimeSeconds: 2,
      integrator: 'semi-implicit-euler',
    });
    const coarse = simulateProjectile({ ...base, timeStepSeconds: 0.2 });
    const fine = simulateProjectile({ ...base, timeStepSeconds: 0.05 });
    const speed = coarse.parametersUsed.initialSpeed ?? 0;
    const expected = analyticalStateAt(
      {
        position: base.launchPosition,
        velocity: {
          x: speed * Math.cos((70 * Math.PI) / 180),
          y: speed * Math.sin((70 * Math.PI) / 180),
        },
        elapsedSeconds: 0,
      },
      { x: 0, y: -9.81 },
      2,
    );
    const coarseError = Math.abs(coarse.finalPosition.y - expected.position.y);
    const fineError = Math.abs(fine.finalPosition.y - expected.position.y);

    expect(fineError).toBeLessThan(coarseError * 0.3);
  });

  it('detects a non-finite numeric state produced during integration', () => {
    const base = inputWithoutObstacles({ power: 1e308, timeStepSeconds: 1 });
    const result = simulateProjectile({
      ...base,
      powerModel: {
        kind: 'linear',
        baseSpeed: 0,
        speedPerPowerUnit: 1,
        minimumPower: 0,
        maximumPower: 1e308,
      },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: {
          kind: 'linear-drag',
          magnitude: 1,
          directionDegrees: 0,
          dragCoefficientPerSecond: 1e308,
        },
      },
    });

    expect(result.terminationReason).toBe('invalid-numeric-state');
    expect(result.errors).toHaveLength(1);
  });
});
