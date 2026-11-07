import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from '../packages/physics/src/defaults';
import {
  evaluateProjectileSummary,
  profileProjectileEvaluation,
  simulateProjectile,
} from '../packages/physics/src/simulation';
import type {
  SimulationInput,
  SimulationPerformanceMetrics,
  SimulationResult,
  SimulationSummary,
  TrajectorySamplingPolicy,
} from '../packages/physics/src/types';

const warmupCount = 2;
const roundCount = 4;

type Mode = 'full' | 'summary';
type VariantKey = 'legacy-full' | 'legacy-summary' | 'optimized-full' | 'optimized-summary';

interface Variant {
  key: VariantKey;
  mode: Mode;
  samplingPolicy: TrajectorySamplingPolicy;
}

interface BenchmarkScenario {
  name: string;
  input: SimulationInput;
  evaluationsPerRound: number;
  memoryEvaluations: number;
}

interface MemoryMeasurement {
  heapBeforeBytes: number;
  heapAfterCollectionBytes: number;
  approximateRetainedHeapIncreaseBytes: number;
  approximatePeakHeapIncreaseBytes: number;
}

interface VariantMeasurement extends MemoryMeasurement {
  mode: Mode;
  samplingPolicy: TrajectorySamplingPolicy;
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
  metrics: SimulationPerformanceMetrics;
}

interface ScenarioComparison {
  scenario: string;
  timeStepSeconds: number;
  variants: Record<VariantKey, VariantMeasurement>;
  optimizedFullSpeedup: number;
  optimizedSummarySpeedup: number;
  optimizedSummaryVersusFull: number;
}

interface VariantAccumulator {
  durations: number[];
  results: Array<SimulationResult | SimulationSummary>;
}

const variants: Variant[] = [
  { key: 'legacy-full', mode: 'full', samplingPolicy: 'legacy-subdivision' },
  { key: 'legacy-summary', mode: 'summary', samplingPolicy: 'legacy-subdivision' },
  { key: 'optimized-full', mode: 'full', samplingPolicy: 'polynomial-safe' },
  { key: 'optimized-summary', mode: 'summary', samplingPolicy: 'polynomial-safe' },
];

describe('controlled physics optimization benchmark', () => {
  it('compares legacy and polynomial-safe sampling in alternating rounds', () => {
    const defaultInput = createDefaultSimulationInput();
    const scenarios: BenchmarkScenario[] = [
      {
        name: 'default-dt',
        input: defaultInput,
        evaluationsPerRound: 12,
        memoryEvaluations: 10,
      },
      {
        name: 'dt-0.001-full-flight',
        input: { ...defaultInput, timeStepSeconds: 0.001, maximumIterations: 30_000 },
        evaluationsPerRound: 2,
        memoryEvaluations: 2,
      },
    ];
    const comparisons = scenarios.map(measureScenario);

    console.log(`PHYSICS_OPTIMIZATION_BENCHMARK ${JSON.stringify(comparisons)}`);

    for (const comparison of comparisons) {
      const reference = comparison.variants['legacy-full'];
      for (const measurement of Object.values(comparison.variants)) {
        expect(measurement.evaluations).toBe(roundCount * scenarioEvaluations(comparison.scenario));
        expect(measurement.averageMilliseconds).toBeGreaterThan(0);
        expect(measurement.iterationsPerEvaluation).toBe(reference.iterationsPerEvaluation);
        expect(measurement.terminationReason).toBe(reference.terminationReason);
        expect(measurement.flightTimeSeconds).toBeCloseTo(reference.flightTimeSeconds, 10);
      }
      expect(comparison.variants['optimized-summary'].retainedPointsPerEvaluation).toBe(0);
      expect(comparison.variants['optimized-full'].retainedPointsPerEvaluation).toBeGreaterThan(1);
      expect(comparison.variants['optimized-summary'].metrics.rk4MainEvaluations).toBe(
        comparison.variants['legacy-summary'].metrics.rk4MainEvaluations,
      );
      expect(
        comparison.variants['optimized-summary'].metrics.rk4PartialEvaluations,
      ).toBeLessThanOrEqual(comparison.variants['legacy-summary'].metrics.rk4PartialEvaluations);
    }
  });

  it('keeps public optimized APIs equivalent to the profiled route', () => {
    const input = createDefaultSimulationInput();
    const full = simulateProjectile(input);
    const summary = evaluateProjectileSummary(input);
    const profiledFull = runVariant(input, variants[2] as Variant, false);
    const profiledSummary = runVariant(input, variants[3] as Variant, false);

    expectEquivalent(full, profiledFull.result);
    expectEquivalent(summary, profiledSummary.result);
  });
});

function scenarioEvaluations(name: string): number {
  return name === 'default-dt' ? 12 : 2;
}

function measureScenario(scenario: BenchmarkScenario): ScenarioComparison {
  const accumulators = Object.fromEntries(
    variants.map((variant) => [variant.key, { durations: [], results: [] }]),
  ) as Record<VariantKey, VariantAccumulator>;

  for (let index = 0; index < warmupCount; index += 1) {
    for (const variant of variants) runVariant(scenario.input, variant, false);
  }

  for (let round = 0; round < roundCount; round += 1) {
    const orderedVariants = round % 2 === 0 ? variants : [...variants].reverse();
    for (const variant of orderedVariants) {
      global.gc?.();
      const accumulator = accumulators[variant.key];
      for (let index = 0; index < scenario.evaluationsPerRound; index += 1) {
        const start = performance.now();
        const evaluation = runVariant(scenario.input, variant, false);
        accumulator.durations.push(performance.now() - start);
        accumulator.results.push(evaluation.result);
      }
    }
  }

  const measurements = Object.fromEntries(
    variants.map((variant) => [
      variant.key,
      createMeasurement(scenario, variant, accumulators[variant.key]),
    ]),
  ) as Record<VariantKey, VariantMeasurement>;

  const reference = measurements['legacy-full'].metrics;
  for (const measurement of Object.values(measurements)) {
    expect(measurement.metrics.mainIntegrationCalls).toBe(reference.mainIntegrationCalls);
  }
  expectEquivalent(
    accumulators['legacy-full'].results[0] as SimulationResult,
    accumulators['optimized-full'].results[0] as SimulationResult,
  );
  expectEquivalent(
    accumulators['legacy-summary'].results[0] as SimulationSummary,
    accumulators['optimized-summary'].results[0] as SimulationSummary,
  );

  return {
    scenario: scenario.name,
    timeStepSeconds: scenario.input.timeStepSeconds,
    variants: measurements,
    optimizedFullSpeedup:
      measurements['legacy-full'].averageMilliseconds /
      measurements['optimized-full'].averageMilliseconds,
    optimizedSummarySpeedup:
      measurements['legacy-summary'].averageMilliseconds /
      measurements['optimized-summary'].averageMilliseconds,
    optimizedSummaryVersusFull:
      measurements['optimized-full'].averageMilliseconds /
      measurements['optimized-summary'].averageMilliseconds,
  };
}

function createMeasurement(
  scenario: BenchmarkScenario,
  variant: Variant,
  accumulator: VariantAccumulator,
): VariantMeasurement {
  const first = accumulator.results[0];
  expect(first).toBeDefined();
  const profile = runVariant(scenario.input, variant, true);
  expect(profile.metrics).not.toBeNull();
  const memory = measureMemory(scenario.input, variant, scenario.memoryEvaluations);
  const durations = accumulator.durations;
  const averageMilliseconds = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const serializedBytes =
    accumulator.results.reduce(
      (sum, result) => sum + Buffer.byteLength(JSON.stringify(result)),
      0,
    ) / accumulator.results.length;
  const retainedPoints =
    accumulator.results.reduce(
      (sum, result) => sum + ('trajectory' in result ? result.trajectory.length : 0),
      0,
    ) / accumulator.results.length;

  return {
    mode: variant.mode,
    samplingPolicy: variant.samplingPolicy,
    evaluations: durations.length,
    averageMilliseconds,
    medianMilliseconds: percentile(durations, 0.5),
    p95Milliseconds: percentile(durations, 0.95),
    evaluationsPerSecond: 1_000 / averageMilliseconds,
    iterationsPerEvaluation: first?.iterations ?? 0,
    retainedPointsPerEvaluation: retainedPoints,
    serializedResultBytesPerEvaluation: serializedBytes,
    terminationReason: first?.terminationReason ?? '',
    flightTimeSeconds: first?.flightTimeSeconds ?? 0,
    metrics: profile.metrics as SimulationPerformanceMetrics,
    ...memory,
  };
}

function measureMemory(
  input: SimulationInput,
  variant: Variant,
  evaluationCount: number,
): MemoryMeasurement {
  global.gc?.();
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  let peakHeapBytes = heapBeforeBytes;
  const retained: Array<SimulationResult | SimulationSummary> = [];
  for (let index = 0; index < evaluationCount; index += 1) {
    retained.push(runVariant(input, variant, false).result);
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
  }
  global.gc?.();
  const heapAfterCollectionBytes = process.memoryUsage().heapUsed;
  expect(retained).toHaveLength(evaluationCount);
  return {
    heapBeforeBytes,
    heapAfterCollectionBytes,
    approximateRetainedHeapIncreaseBytes: Math.max(0, heapAfterCollectionBytes - heapBeforeBytes),
    approximatePeakHeapIncreaseBytes: Math.max(0, peakHeapBytes - heapBeforeBytes),
  };
}

function runVariant(input: SimulationInput, variant: Variant, collectMetrics: boolean) {
  return profileProjectileEvaluation(input, {
    mode: variant.mode,
    samplingPolicy: variant.samplingPolicy,
    collectMetrics,
  });
}

function expectEquivalent(
  left: SimulationResult | SimulationSummary,
  right: SimulationResult | SimulationSummary,
) {
  expect(right.status).toBe(left.status);
  expect(right.terminationReason).toBe(left.terminationReason);
  expect(right.iterations).toBe(left.iterations);
  expect(right.flightTimeSeconds).toBeCloseTo(left.flightTimeSeconds, 10);
  expect(right.maximumHeight).toBeCloseTo(left.maximumHeight, 9);
  expect(right.impact?.kind).toBe(left.impact?.kind);
  expect(right.impact?.targetId).toBe(left.impact?.targetId);
  expect(right.impact?.terrainSegmentIndex).toBe(left.impact?.terrainSegmentIndex);
  if (left.impact && right.impact) {
    expect(right.impact.point.x).toBeCloseTo(left.impact.point.x, 9);
    expect(right.impact.point.y).toBeCloseTo(left.impact.point.y, 9);
    expect(right.impact.elapsedSeconds).toBeCloseTo(left.impact.elapsedSeconds, 10);
  }
  const leftFinal = 'trajectory' in left ? left.finalPosition : left.finalState.position;
  const rightFinal = 'trajectory' in right ? right.finalPosition : right.finalState.position;
  expect(rightFinal.x).toBeCloseTo(leftFinal.x, 9);
  expect(rightFinal.y).toBeCloseTo(leftFinal.y, 9);
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index] ?? Number.NaN;
}
