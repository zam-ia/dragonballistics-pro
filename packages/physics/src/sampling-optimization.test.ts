import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from './defaults';
import { profileProjectileEvaluation } from './simulation';
import type {
  SimulationInput,
  SimulationResult,
  SimulationSummary,
  TrajectorySamplingPolicy,
} from './types';

function inputWithoutObstacles(overrides: Partial<SimulationInput> = {}): SimulationInput {
  const base = createDefaultSimulationInput({ x: 0, y: 0 }, { x: 900, y: 900 });
  return {
    ...base,
    bounds: { minimumX: -2_000, maximumX: 2_000, minimumY: -2_000, maximumY: 2_000 },
    collisions: { terrain: [], targets: [] },
    ...overrides,
  };
}

function curvedStep(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return inputWithoutObstacles({
    launchPosition: { x: 0, y: 10 },
    launchAngleDegrees: 45,
    power: Math.hypot(10, 10),
    powerModel: {
      kind: 'linear',
      baseSpeed: 0,
      speedPerPowerUnit: 1,
      minimumPower: 0,
      maximumPower: 100,
    },
    environment: {
      gravity: 20,
      additionalAcceleration: { x: 0, y: 0 },
      wind: { kind: 'none' },
    },
    integrator: 'rk4',
    timeStepSeconds: 1,
    maximumTimeSeconds: 1,
    maximumIterations: 10,
    bounds: { minimumX: -100, maximumX: 100, minimumY: -100, maximumY: 100 },
    collisions: { terrain: [], targets: [] },
    ...overrides,
  });
}

function nearToleranceCurve(overrides: Partial<SimulationInput> = {}): SimulationInput {
  const verticalSpeed = 1e-6;
  const horizontalSpeed = 1;
  return inputWithoutObstacles({
    launchPosition: { x: 0, y: 0 },
    launchAngleDegrees: (Math.atan2(verticalSpeed, horizontalSpeed) * 180) / Math.PI,
    power: Math.hypot(horizontalSpeed, verticalSpeed),
    powerModel: {
      kind: 'linear',
      baseSpeed: 0,
      speedPerPowerUnit: 1,
      minimumPower: 0,
      maximumPower: 2,
    },
    environment: {
      gravity: 2e-6,
      additionalAcceleration: { x: 0, y: 0 },
      wind: { kind: 'none' },
    },
    integrator: 'rk4',
    timeStepSeconds: 1,
    maximumTimeSeconds: 1,
    maximumIterations: 2,
    bounds: { minimumX: -2, maximumX: 2, minimumY: -2, maximumY: 2 },
    collisions: { terrain: [], targets: [] },
    ...overrides,
  });
}

const scenarios: Array<{ name: string; input: SimulationInput; targetId?: string }> = [
  {
    name: 'recta sin gravedad y paso grande',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 5 },
      launchAngleDegrees: 20,
      environment: {
        gravity: 0,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'none' },
      },
      timeStepSeconds: 1,
      maximumTimeSeconds: 3,
    }),
  },
  {
    name: 'suelo horizontal',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 12 },
      power: 24,
      launchAngleDegrees: 25,
      collisions: { groundY: 0, terrain: [], targets: [] },
    }),
  },
  {
    name: 'terreno segmentado',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 15 },
      launchAngleDegrees: -20,
      power: 20,
      collisions: {
        terrain: [
          { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
          { start: { x: 20, y: 0 }, end: { x: 40, y: 8 } },
        ],
        targets: [],
      },
    }),
  },
  {
    name: 'objetivo pequeno sobre curva',
    input: curvedStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'tiny', center: { x: 5, y: 12.5 }, radius: 0.01 }],
      },
    }),
    targetId: 'tiny',
  },
  {
    name: 'tangencia curva',
    input: curvedStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'tangent', center: { x: 5, y: 12.7 }, radius: 0.2 }],
      },
    }),
    targetId: 'tangent',
  },
  {
    name: 'salida intermedia con extremos dentro',
    input: curvedStep({
      bounds: { minimumX: -100, maximumX: 100, minimumY: -100, maximumY: 12 },
    }),
  },
  {
    name: 'terreno dentro del tubo curvo proximo a la tolerancia',
    input: nearToleranceCurve({
      collisions: {
        terrain: [{ start: { x: 0, y: 2e-7 }, end: { x: 1, y: 2e-7 } }],
        targets: [],
      },
    }),
  },
  {
    name: 'salida de limite dentro del tubo curvo proximo a la tolerancia',
    input: nearToleranceCurve({
      bounds: { minimumX: -2, maximumX: 2, minimumY: -2, maximumY: 2e-7 },
    }),
  },
  {
    name: 'viento vectorial',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 10 },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'acceleration', magnitude: 3, directionDegrees: 120 },
      },
      collisions: { groundY: 0, terrain: [], targets: [] },
    }),
  },
  {
    name: 'arrastre lineal',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 10 },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0.2, y: 0.1 },
        wind: {
          kind: 'linear-drag',
          magnitude: 4,
          directionDegrees: 15,
          dragCoefficientPerSecond: 0.35,
        },
      },
      maximumTimeSeconds: 3,
    }),
  },
  {
    name: 'paso pequeno',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 10 },
      timeStepSeconds: 0.001,
      maximumTimeSeconds: 0.1,
      maximumIterations: 200,
    }),
  },
];

describe('polynomial-safe trajectory sampling', () => {
  for (const mode of ['full', 'summary'] as const) {
    it.each(scenarios)(`mantiene paridad legacy en ${mode}: $name`, ({ input, targetId }) => {
      const legacy = evaluateWithPolicy(input, mode, 'legacy-subdivision', targetId);
      const optimized = evaluateWithPolicy(input, mode, 'polynomial-safe', targetId);

      expectEquivalent(optimized, legacy);
    });
  }

  it('reduce integraciones parciales en pasos pequenos y expone metricas consistentes', () => {
    const input = createDefaultSimulationInput();
    const legacy = profileProjectileEvaluation(input, {
      mode: 'summary',
      samplingPolicy: 'legacy-subdivision',
    });
    const optimized = profileProjectileEvaluation(input, {
      mode: 'summary',
      samplingPolicy: 'polynomial-safe',
    });
    const legacyMetrics = legacy.metrics;
    const optimizedMetrics = optimized.metrics;

    expect(legacyMetrics).not.toBeNull();
    expect(optimizedMetrics).not.toBeNull();
    expect(optimizedMetrics?.mainIntegrationCalls).toBe(optimized.result.iterations);
    expect(optimizedMetrics?.rk4MainEvaluations).toBe(optimized.result.iterations);
    expect(optimizedMetrics?.stateAtFractionCalls).toBe(
      (optimizedMetrics?.stateCacheHits ?? 0) + (optimizedMetrics?.stateCacheMisses ?? 0),
    );
    expect(optimizedMetrics?.partialIntegrationCalls).toBeLessThanOrEqual(
      legacyMetrics?.partialIntegrationCalls ?? 0,
    );
    expect(optimizedMetrics?.flattenSubdivisions).toBeLessThanOrEqual(
      legacyMetrics?.flattenSubdivisions ?? 0,
    );
    expect(optimizedMetrics?.collisionMilliseconds).toBeGreaterThanOrEqual(
      optimizedMetrics?.closestApproachMilliseconds ?? 0,
    );
  });
});

function evaluateWithPolicy(
  input: SimulationInput,
  mode: 'full' | 'summary',
  samplingPolicy: TrajectorySamplingPolicy,
  targetId: string | undefined,
) {
  return profileProjectileEvaluation(input, {
    mode,
    samplingPolicy,
    collectMetrics: false,
    ...(targetId === undefined ? {} : { targetId }),
  }).result;
}

function expectEquivalent(
  actual: SimulationResult | SimulationSummary,
  expected: SimulationResult | SimulationSummary,
) {
  expect(actual.status).toBe(expected.status);
  expect(actual.terminationReason).toBe(expected.terminationReason);
  expect(actual.iterations).toBe(expected.iterations);
  expect(actual.flightTimeSeconds).toBeCloseTo(expected.flightTimeSeconds, 8);
  expect(actual.maximumHeight).toBeCloseTo(expected.maximumHeight, 9);
  expect(actual.impact?.kind).toBe(expected.impact?.kind);
  expect(actual.impact?.targetId).toBe(expected.impact?.targetId);
  expect(actual.impact?.terrainSegmentIndex).toBe(expected.impact?.terrainSegmentIndex);
  if (actual.impact && expected.impact) {
    expect(actual.impact.point.x).toBeCloseTo(expected.impact.point.x, 7);
    expect(actual.impact.point.y).toBeCloseTo(expected.impact.point.y, 7);
    expect(actual.impact.elapsedSeconds).toBeCloseTo(expected.impact.elapsedSeconds, 8);
  }
  const actualFinal = 'trajectory' in actual ? actual.finalPosition : actual.finalState.position;
  const expectedFinal =
    'trajectory' in expected ? expected.finalPosition : expected.finalState.position;
  expect(actualFinal.x).toBeCloseTo(expectedFinal.x, 7);
  expect(actualFinal.y).toBeCloseTo(expectedFinal.y, 7);
  if ('closestApproach' in actual && 'closestApproach' in expected) {
    if (!actual.closestApproach || !expected.closestApproach) {
      expect(actual.closestApproach).toBe(expected.closestApproach);
      return;
    }
    expect(actual.closestApproach?.targetId).toBe(expected.closestApproach?.targetId);
    expect(actual.closestApproach?.surfaceDistance).toBeCloseTo(
      expected.closestApproach.surfaceDistance,
      5,
    );
  }
}
