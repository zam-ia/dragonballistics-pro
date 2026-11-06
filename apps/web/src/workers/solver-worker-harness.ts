import { createDefaultSimulationInput } from '@dragonballistics/physics';
import type { SolverInput } from '@dragonballistics/physics';
import { createSolverWorkerController } from './solver-worker-controller';

function makeInput(highResolution = false): SolverInput {
  const simulation = createDefaultSimulationInput({ x: 0, y: 0 }, { x: 140, y: 1 });
  return {
    simulation: {
      ...simulation,
      launchAngleDegrees: 30,
      power: 40,
      powerModel: {
        kind: 'linear',
        baseSpeed: 0,
        speedPerPowerUnit: 1,
        minimumPower: 0,
        maximumPower: 70,
      },
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: { kind: 'none' },
      },
      timeStepSeconds: highResolution ? 0.001 : 0.05,
      maximumTimeSeconds: 14,
      maximumIterations: highResolution ? 14_000 : 400,
      bounds: { minimumX: -20, maximumX: 900, minimumY: -20, maximumY: 500 },
      collisions: {
        groundY: 0,
        terrain: [],
        targets: [{ id: 'goal', center: { x: 140, y: 1 }, radius: 3 }],
      },
    },
    targetId: 'goal',
    angleRange: { minimum: 10, maximum: 80 },
    powerRange: { minimum: 40, maximum: 40 },
    requestedSolutions: 4,
    budgets: {
      maximumEvaluations: 320,
      maximumWallTimeMs: highResolution ? 5000 : 2000,
      coarseFraction: 0.45,
      refinementRounds: 6,
    },
  };
}

// Test-only entry, without a user-facing solver panel or React integration.
// A production UI will consume the controller only in Phase 3D.
Object.assign(window, {
  __solverWorkerHarness: {
    create: createSolverWorkerController,
    makeInput,
  },
});
