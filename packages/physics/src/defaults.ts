import type { Vec2 } from '@dragonballistics/shared';
import type { SimulationInput } from './types';

export function createDefaultSimulationInput(
  launchPosition: Vec2 = { x: 120, y: 80 },
  targetPosition: Vec2 = { x: 680, y: 150 },
): SimulationInput {
  return {
    launchPosition,
    launchAngleDegrees: 45,
    power: 75,
    powerModel: {
      kind: 'linear',
      baseSpeed: 0,
      speedPerPowerUnit: 1,
      minimumPower: 0,
      maximumPower: 120,
    },
    environment: {
      gravity: 9.81,
      additionalAcceleration: { x: 0, y: 0 },
      wind: { kind: 'acceleration', magnitude: 0, directionDegrees: 0 },
    },
    integrator: 'rk4',
    timeStepSeconds: 0.02,
    maximumTimeSeconds: 30,
    maximumIterations: 5_000,
    bounds: { minimumX: 0, maximumX: 800, minimumY: 0, maximumY: 400 },
    collisions: {
      groundY: 0,
      terrain: [],
      targets: [{ id: 'workspace-target', center: targetPosition, radius: 10 }],
    },
  };
}
