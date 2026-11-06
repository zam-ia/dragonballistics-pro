import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from '../packages/physics/src/defaults';
import { evaluateProjectileSummary, simulateProjectile } from '../packages/physics/src/simulation';
import type {
  SimulationInput,
  SimulationResult,
  SimulationSummary,
} from '../packages/physics/src/types';

const warmupCount = 3;

interface BenchmarkScenario {
  name: string;
  input: SimulationInput;
  evaluationCount: number;
}

interface ModeMeasurement {
  mode: 'full' | 'summary';
  evaluations: number;
  averageMilliseconds: number;
  medianMilliseconds: number;
  p95Milliseconds: number;
  evaluationsPerSecond: number;
  iterationsPerEvaluation: number;
  retainedPointsPerEvaluation: number;
  serializedResultBytesPerEvaluation: number;
  terminationReason: string;
  flightTimeSeconds: number;
  heapBeforeBytes: number;
  heapAfterCollectionBytes: number;
  approximateRetainedHeapIncreaseBytes: number;
  approximatePeakHeapIncreaseBytes: number;
}

interface ScenarioComparison {
  scenario: string;
  timeStepSeconds: number;
  full: ModeMeasurement;
  summary: ModeMeasurement;
  timeSpeedup: number;
  serializedPayloadReductionRatio: number;
}

describe('full versus summary reproducible benchmark', () => {
  it('compares normal and high-resolution trajectories', () => {
    const defaultInput = createDefaultSimulationInput();
    const scenarios: BenchmarkScenario[] = [
      { name: 'default-dt', input: defaultInput, evaluationCount: 20 },
      {
        name: 'dt-0.001-full-flight',
        input: { ...defaultInput, timeStepSeconds: 0.001, maximumIterations: 30_000 },
        evaluationCount: 5,
      },
    ];
    const comparisons = scenarios.map(measureScenario);

    console.log(`PHYSICS_SUMMARY_BENCHMARK ${JSON.stringify(comparisons)}`);

    for (const comparison of comparisons) {
      expect(comparison.full.evaluations).toBe(comparison.summary.evaluations);
      expect(comparison.full.averageMilliseconds).toBeGreaterThan(0);
      expect(comparison.summary.averageMilliseconds).toBeGreaterThan(0);
      expect(comparison.full.iterationsPerEvaluation).toBe(
        comparison.summary.iterationsPerEvaluation,
      );
      expect(comparison.full.terminationReason).toBe(comparison.summary.terminationReason);
      expect(comparison.full.flightTimeSeconds).toBeCloseTo(
        comparison.summary.flightTimeSeconds,
        12,
      );
      expect(comparison.full.retainedPointsPerEvaluation).toBeGreaterThan(1);
      expect(comparison.summary.retainedPointsPerEvaluation).toBe(0);
      expect(Number.isFinite(comparison.timeSpeedup)).toBe(true);
    }
  });
});

function measureScenario(scenario: BenchmarkScenario): ScenarioComparison {
  warmUp(scenario.input);
  const full = measureMode('full', scenario.input, scenario.evaluationCount);
  const summary = measureMode('summary', scenario.input, scenario.evaluationCount);
  const serializedPayloadReductionRatio =
    1 - summary.serializedResultBytesPerEvaluation / full.serializedResultBytesPerEvaluation;

  return {
    scenario: scenario.name,
    timeStepSeconds: scenario.input.timeStepSeconds,
    full,
    summary,
    timeSpeedup: full.averageMilliseconds / summary.averageMilliseconds,
    serializedPayloadReductionRatio,
  };
}

function warmUp(input: SimulationInput) {
  for (let index = 0; index < warmupCount; index += 1) {
    simulateProjectile(input);
    evaluateProjectileSummary(input);
  }
}

function measureMode(
  mode: ModeMeasurement['mode'],
  input: SimulationInput,
  evaluationCount: number,
): ModeMeasurement {
  global.gc?.();
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  let peakHeapBytes = heapBeforeBytes;
  let totalIterations = 0;
  let totalRetainedPoints = 0;
  let totalSerializedResultBytes = 0;
  let checksum = 0;
  let terminationReason = '';
  let flightTimeSeconds = 0;
  const durations: number[] = [];
  const retainedResults: Array<SimulationResult | SimulationSummary> = [];

  for (let index = 0; index < evaluationCount; index += 1) {
    const start = performance.now();
    const result = mode === 'full' ? simulateProjectile(input) : evaluateProjectileSummary(input);
    durations.push(performance.now() - start);
    retainedResults.push(result);
    totalSerializedResultBytes += Buffer.byteLength(JSON.stringify(result));
    totalIterations += result.iterations;
    if ('trajectory' in result) totalRetainedPoints += result.trajectory.length;
    terminationReason = result.terminationReason;
    flightTimeSeconds = result.flightTimeSeconds;
    const finalPosition =
      'trajectory' in result ? result.finalPosition : result.finalState.position;
    checksum += finalPosition.x + finalPosition.y + result.flightTimeSeconds;
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
  }

  global.gc?.();
  const heapAfterCollectionBytes = process.memoryUsage().heapUsed;
  expect(retainedResults).toHaveLength(evaluationCount);
  expect(Number.isFinite(checksum)).toBe(true);

  const averageMilliseconds = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return {
    mode,
    evaluations: evaluationCount,
    averageMilliseconds,
    medianMilliseconds: percentile(durations, 0.5),
    p95Milliseconds: percentile(durations, 0.95),
    evaluationsPerSecond: 1_000 / averageMilliseconds,
    iterationsPerEvaluation: totalIterations / evaluationCount,
    retainedPointsPerEvaluation: totalRetainedPoints / evaluationCount,
    serializedResultBytesPerEvaluation: totalSerializedResultBytes / evaluationCount,
    terminationReason,
    flightTimeSeconds,
    heapBeforeBytes,
    heapAfterCollectionBytes,
    approximateRetainedHeapIncreaseBytes: Math.max(0, heapAfterCollectionBytes - heapBeforeBytes),
    approximatePeakHeapIncreaseBytes: Math.max(0, peakHeapBytes - heapBeforeBytes),
  };
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index] ?? Number.NaN;
}
