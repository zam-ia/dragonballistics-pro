import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from './defaults';
import { evaluateProjectileSummary, simulateProjectile } from './simulation';
import type {
  ImpactResult,
  SimulationInput,
  SummaryEvaluationOptions,
  TrajectoryPoint,
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

function curvedOneSecondStep(overrides: Partial<SimulationInput> = {}): SimulationInput {
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

const parityCases: Array<{
  name: string;
  input: SimulationInput;
  options?: SummaryEvaluationOptions;
}> = [
  {
    name: 'gravedad constante',
    input: inputWithoutObstacles({
      launchPosition: { x: 2, y: 10 },
      launchAngleDegrees: 35,
      power: 30,
      maximumTimeSeconds: 2,
      timeStepSeconds: 0.02,
    }),
  },
  {
    name: 'viento horizontal',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 5 },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'acceleration', magnitude: 2, directionDegrees: 180 },
      },
      collisions: { groundY: 0, terrain: [], targets: [] },
    }),
  },
  {
    name: 'viento vertical',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 5 },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'acceleration', magnitude: 2, directionDegrees: 90 },
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
        additionalAcceleration: { x: 0, y: 0 },
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
    name: 'suelo horizontal',
    input: inputWithoutObstacles({
      launchPosition: { x: 0, y: 12 },
      power: 24,
      launchAngleDegrees: 25,
      timeStepSeconds: 0.1,
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
    name: 'objetivo pequeno y colision curva',
    input: curvedOneSecondStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'tiny', center: { x: 5, y: 12.5 }, radius: 0.01 }],
      },
    }),
    options: { targetId: 'tiny' },
  },
  {
    name: 'contacto tangencial',
    input: curvedOneSecondStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'tangent', center: { x: 5, y: 12.7 }, radius: 0.2 }],
      },
    }),
    options: { targetId: 'tangent' },
  },
  {
    name: 'rechazo de falso positivo de cuerda',
    input: curvedOneSecondStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'chord-only', center: { x: 5, y: 10 }, radius: 0.2 }],
      },
    }),
    options: { targetId: 'chord-only' },
  },
  {
    name: 'salida curva de limites',
    input: curvedOneSecondStep({
      bounds: { minimumX: -100, maximumX: 100, minimumY: -100, maximumY: 12 },
    }),
  },
  {
    name: 'contacto inicial descendente',
    input: curvedOneSecondStep({
      launchPosition: { x: 5, y: 10 },
      launchAngleDegrees: -45,
      collisions: {
        terrain: [{ start: { x: 0, y: 10 }, end: { x: 20, y: 10 } }],
        targets: [],
      },
    }),
  },
  {
    name: 'contacto inicial con objetivo',
    input: curvedOneSecondStep({
      collisions: {
        terrain: [],
        targets: [{ id: 'initial-target', center: { x: 0, y: 10 }, radius: 0.1 }],
      },
    }),
    options: { targetId: 'initial-target' },
  },
  {
    name: 'separacion inicial ascendente',
    input: curvedOneSecondStep({
      launchPosition: { x: 5, y: 10 },
      launchAngleDegrees: 45,
      timeStepSeconds: 0.25,
      maximumTimeSeconds: 0.25,
      collisions: {
        terrain: [{ start: { x: 0, y: 10 }, end: { x: 20, y: 10 } }],
        targets: [],
      },
    }),
  },
  {
    name: 'entrada invalida',
    input: inputWithoutObstacles({ timeStepSeconds: 0 }),
  },
  {
    name: 'limite de iteraciones',
    input: inputWithoutObstacles({
      maximumIterations: 2,
      maximumTimeSeconds: 10,
      timeStepSeconds: 0.1,
    }),
  },
  {
    name: 'estado numerico invalido',
    input: {
      ...inputWithoutObstacles({ power: 1e308, timeStepSeconds: 1 }),
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
    },
  },
];

describe('summary evaluation', () => {
  it.each(parityCases)('preserva paridad fisica: $name', ({ input, options }) => {
    const full = simulateProjectile(input);
    const summary = evaluateProjectileSummary(input, options);
    const fullFinalState = full.trajectory.at(-1);

    expect(fullFinalState).toBeDefined();
    expect(summary.status).toBe(full.status);
    expect(summary.terminationReason).toBe(full.terminationReason);
    expectPoint(summary.finalState, fullFinalState as TrajectoryPoint);
    expectPoint(summary.apexPoint, full.apexPoint);
    expectImpact(summary.impact, full.impact);
    expect(summary.flightTimeSeconds).toBeCloseTo(full.flightTimeSeconds, 12);
    expect(summary.horizontalRange).toBeCloseTo(full.horizontalRange, 12);
    expect(summary.maximumHeight).toBeCloseTo(full.maximumHeight, 12);
    expect(summary.iterations).toBe(full.iterations);
    expect(summary.warnings).toEqual(full.warnings);
    expect(summary.errors).toEqual(full.errors);
    expect(summary.parametersUsed).toEqual(full.parametersUsed);
  });

  it('mantiene la API full y no expone una trayectoria acumulada en summary', () => {
    const input = inputWithoutObstacles({ maximumTimeSeconds: 0.3, timeStepSeconds: 0.1 });
    const full = simulateProjectile(input);
    const summary = evaluateProjectileSummary(input);

    expect(full.trajectory).toHaveLength(full.iterations + 1);
    expect(full.trajectory[0]?.elapsedSeconds).toBe(0);
    expect(full.trajectory.at(-1)?.position).toEqual(full.finalPosition);
    expect('trajectory' in summary).toBe(false);
  });

  it('calcula aproximacion continua sobre la misma polilinea adaptativa', () => {
    const target = { id: 'missed-target', center: { x: 5, y: 10 }, radius: 0.2 };
    const summary = evaluateProjectileSummary(
      curvedOneSecondStep({ collisions: { terrain: [], targets: [target] } }),
      { targetId: target.id },
    );

    expect(summary.terminationReason).toBe('maximum-time');
    expect(summary.closestApproach?.targetId).toBe(target.id);
    expect(summary.closestApproach?.elapsedSeconds).toBeCloseTo(0.5, 3);
    expect(summary.closestApproach?.centerDistance).toBeCloseTo(2.5, 4);
    expect(summary.closestApproach?.surfaceDistance).toBeCloseTo(2.3, 4);
    expect(summary.closestApproach?.spatialTolerance).toBeLessThanOrEqual(1e-5);
  });

  it('registra distancia superficial cero cuando impacta el objetivo seleccionado', () => {
    const target = { id: 'selected-target', center: { x: 5, y: 12.5 }, radius: 0.2 };
    const summary = evaluateProjectileSummary(
      curvedOneSecondStep({ collisions: { terrain: [], targets: [target] } }),
      { targetId: target.id },
    );

    expect(summary.terminationReason).toBe('target-impact');
    expect(summary.closestApproach?.surfaceDistance).toBe(0);
    expect(summary.closestApproach?.elapsedSeconds).toBeCloseTo(summary.flightTimeSeconds, 10);
  });

  it('rechaza un targetId que no existe sin ejecutar la simulacion', () => {
    const summary = evaluateProjectileSummary(createDefaultSimulationInput(), {
      targetId: 'missing-target',
    });

    expect(summary.status).toBe('invalid');
    expect(summary.terminationReason).toBe('invalid-input');
    expect(summary.iterations).toBe(0);
    expect(summary.closestApproach).toBeNull();
    expect(summary.errors).toContainEqual(expect.objectContaining({ code: 'target-not-found' }));
  });
});

function expectPoint(actual: TrajectoryPoint, expected: TrajectoryPoint) {
  expect(actual.position.x).toBeCloseTo(expected.position.x, 12);
  expect(actual.position.y).toBeCloseTo(expected.position.y, 12);
  expect(actual.velocity.x).toBeCloseTo(expected.velocity.x, 12);
  expect(actual.velocity.y).toBeCloseTo(expected.velocity.y, 12);
  expect(actual.elapsedSeconds).toBeCloseTo(expected.elapsedSeconds, 12);
}

function expectImpact(actual: ImpactResult | null, expected: ImpactResult | null) {
  if (!actual || !expected) {
    expect(actual).toBe(expected);
    return;
  }
  expect(actual.kind).toBe(expected.kind);
  expect(actual.targetId).toBe(expected.targetId);
  expect(actual.terrainSegmentIndex).toBe(expected.terrainSegmentIndex);
  expect(actual.point.x).toBeCloseTo(expected.point.x, 12);
  expect(actual.point.y).toBeCloseTo(expected.point.y, 12);
  expect(actual.normal.x).toBeCloseTo(expected.normal.x, 12);
  expect(actual.normal.y).toBeCloseTo(expected.normal.y, 12);
  expect(actual.elapsedSeconds).toBeCloseTo(expected.elapsedSeconds, 12);
}
