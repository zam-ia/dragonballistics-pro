import { describe, expect, it } from 'vitest';
import { solveProjectile } from '../packages/physics/src/solver';
import type { SolverInput } from '../packages/physics/src/solver';
import type { SimulationInput } from '../packages/physics/src/types';

interface Scenario {
  name: string;
  wind: SimulationInput['environment']['wind'];
  targetRadius: number;
  targetX: number;
}
const scenarios: Scenario[] = [
  { name: 'calm-large', wind: { kind: 'none' }, targetRadius: 5, targetX: 140 },
  { name: 'calm-small', wind: { kind: 'none' }, targetRadius: 0.8, targetX: 140 },
  { name: 'horizontal-wind-large', wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 0 }, targetRadius: 5, targetX: 140 },
  { name: 'horizontal-wind-small', wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 0 }, targetRadius: 0.8, targetX: 140 },
  { name: 'vertical-wind-large', wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 90 }, targetRadius: 5, targetX: 140 },
  { name: 'vertical-wind-small', wind: { kind: 'acceleration', magnitude: 1, directionDegrees: 90 }, targetRadius: 0.8, targetX: 140 },
];

function inputFor(s: Scenario): SolverInput {
  return {
    simulation: {
      launchPosition: { x: 0, y: 0 },
      launchAngleDegrees: 30,
      power: 40,
      powerModel: { kind: 'linear', baseSpeed: 0, speedPerPowerUnit: 1, minimumPower: 0, maximumPower: 70 },
      environment: { gravity: 9.81, additionalAcceleration: { x: 0, y: 0 }, wind: s.wind },
      integrator: 'rk4',
      timeStepSeconds: 0.05,
      maximumTimeSeconds: 14,
      maximumIterations: 400,
      bounds: { minimumX: -20, maximumX: 900, minimumY: -20, maximumY: 500 },
      collisions: { groundY: 0, terrain: [], targets: [{ id: 'goal', center: { x: s.targetX, y: 1 }, radius: s.targetRadius }] },
    },
    targetId: 'goal',
    angleRange: { minimum: 10, maximum: 80 },
    powerRange: { minimum: 40, maximum: 40 },
    requestedSolutions: 4,
    budgets: { maximumEvaluations: 320, maximumWallTimeMs: 2000, coarseFraction: 0.45, refinementRounds: 6 },
  };
}

describe('inverse solver benchmark — reproducible synthetic scenarios', () => {
  it('measures throughput, coverage and wall-clock termination across wind and radii', () => {
    const measurements = scenarios.map((scenario) => {
      const input = inputFor(scenario);
      const beforeHeap = process.memoryUsage().heapUsed;
      const start = performance.now();
      const result = solveProjectile(input);
      const duration = performance.now() - start;
      return {
        scenario: scenario.name,
        targetRadius: scenario.targetRadius,
        wind: scenario.wind,
        elapsedMilliseconds: duration,
        solverElapsedMilliseconds: result.elapsedMilliseconds,
        evaluations: result.evaluatedCandidates,
        evaluationsPerSecond: result.evaluatedCandidates / Math.max(duration / 1000, 0.000001),
        coarseEvaluations: result.coarseEvaluations,
        coarseMilliseconds: result.coarseMilliseconds,
        refinementEvaluations: result.refinementEvaluations,
        refinementMilliseconds: result.refinementMilliseconds,
        verificationEvaluations: result.verificationEvaluations,
        candidateCount: result.solutions.length,
        hitCount: result.hitCount,
        bestMissDistance: result.solutions[0]?.missDistance ?? null,
        success: result.solutions.some((c) => c.hit),
        termination: result.stopReason,
        status: result.status,
        approximateHeapDeltaBytes: process.memoryUsage().heapUsed - beforeHeap,
      };
    });
    const successRate = measurements.filter((m) => m.success).length / measurements.length;
    console.log('INVERSE_SOLVER_BENCHMARK ' + JSON.stringify({ scenarios: measurements, successRate }));
    for (const measurement of measurements) {
      expect(measurement.evaluations).toBeLessThanOrEqual(320);
      expect(measurement.elapsedMilliseconds).toBeGreaterThanOrEqual(0);
      expect(measurement.coarseMilliseconds).toBeGreaterThanOrEqual(0);
      expect(measurement.refinementMilliseconds).toBeGreaterThanOrEqual(0);
    }
  });
});
