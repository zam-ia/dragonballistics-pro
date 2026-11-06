import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from '../packages/physics/src/defaults';
import { simulateProjectile } from '../packages/physics/src/simulation';

const evaluationCount = 10;
const warmupCount = 2;

interface BenchmarkMeasurement {
  scenario: string;
  timeStepSeconds: number;
  evaluations: number;
  elapsedMilliseconds: number;
  millisecondsPerEvaluation: number;
  totalIterations: number;
  iterationsPerEvaluation: number;
  totalTrajectoryPoints: number;
  trajectoryPointsPerEvaluation: number;
  terminationReason: string;
  flightTimeSeconds: number;
  heapBeforeBytes: number;
  heapAfterBytes: number;
  approximatePeakHeapIncreaseBytes: number;
}

describe('physics engine reproducible benchmark', () => {
  it('measures default parameters and dt=0.001', () => {
    const defaultInput = createDefaultSimulationInput();
    const measurements = [
      measureScenario('default-dt', defaultInput),
      measureScenario('dt-0.001', { ...defaultInput, timeStepSeconds: 0.001 }),
      measureScenario('dt-0.001-full-flight', {
        ...defaultInput,
        timeStepSeconds: 0.001,
        maximumIterations: 30_000,
      }),
    ];

    console.log(`PHYSICS_BENCHMARK ${JSON.stringify(measurements)}`);

    for (const measurement of measurements) {
      expect(measurement.evaluations).toBe(evaluationCount);
      expect(measurement.elapsedMilliseconds).toBeGreaterThan(0);
      expect(measurement.iterationsPerEvaluation).toBeGreaterThan(0);
      expect(measurement.trajectoryPointsPerEvaluation).toBeGreaterThan(1);
    }
  });
});

function measureScenario(
  scenario: string,
  input: ReturnType<typeof createDefaultSimulationInput>,
): BenchmarkMeasurement {
  for (let index = 0; index < warmupCount; index += 1) simulateProjectile(input);

  const heapBeforeBytes = process.memoryUsage().heapUsed;
  let peakHeapBytes = heapBeforeBytes;
  let totalIterations = 0;
  let totalTrajectoryPoints = 0;
  let checksum = 0;
  let terminationReason = '';
  let flightTimeSeconds = 0;
  const start = performance.now();

  for (let index = 0; index < evaluationCount; index += 1) {
    const result = simulateProjectile(input);
    totalIterations += result.iterations;
    totalTrajectoryPoints += result.trajectory.length;
    terminationReason = result.terminationReason;
    flightTimeSeconds = result.flightTimeSeconds;
    checksum += result.finalPosition.x + result.finalPosition.y + result.flightTimeSeconds;
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
  }

  const elapsedMilliseconds = performance.now() - start;
  const heapAfterBytes = process.memoryUsage().heapUsed;
  expect(Number.isFinite(checksum)).toBe(true);
  return {
    scenario,
    timeStepSeconds: input.timeStepSeconds,
    evaluations: evaluationCount,
    elapsedMilliseconds,
    millisecondsPerEvaluation: elapsedMilliseconds / evaluationCount,
    totalIterations,
    iterationsPerEvaluation: totalIterations / evaluationCount,
    totalTrajectoryPoints,
    trajectoryPointsPerEvaluation: totalTrajectoryPoints / evaluationCount,
    terminationReason,
    flightTimeSeconds,
    heapBeforeBytes,
    heapAfterBytes,
    approximatePeakHeapIncreaseBytes: Math.max(0, peakHeapBytes - heapBeforeBytes),
  };
}
