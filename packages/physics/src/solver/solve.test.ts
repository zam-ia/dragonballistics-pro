import { describe, expect, it } from 'vitest';
import { simulateProjectile } from '../simulation';
import type { SimulationInput } from '../types';
import { solveProjectile } from './solve';
import type { SolverInput, SolverResult } from './types';

function scenario(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    launchPosition: { x: 0, y: 0 },
    launchAngleDegrees: 30,
    power: 40,
    powerModel: {
      kind: 'linear',
      baseSpeed: 0,
      speedPerPowerUnit: 1,
      minimumPower: 0,
      maximumPower: 70,
    },
    environment: { gravity: 9.81, additionalAcceleration: { x: 0, y: 0 }, wind: { kind: 'none' } },
    integrator: 'rk4',
    timeStepSeconds: 0.05,
    maximumTimeSeconds: 14,
    maximumIterations: 400,
    bounds: { minimumX: -20, maximumX: 900, minimumY: -20, maximumY: 500 },
    collisions: {
      groundY: 0,
      terrain: [],
      targets: [{ id: 'goal', center: { x: 140, y: 1 }, radius: 3 }],
    },
    ...overrides,
  };
}

function request(simulation = scenario(), overrides: Partial<SolverInput> = {}): SolverInput {
  return {
    simulation,
    targetId: 'goal',
    angleRange: { minimum: 10, maximum: 80 },
    powerRange: { minimum: 40, maximum: 40 },
    requestedSolutions: 4,
    budgets: {
      maximumEvaluations: 320,
      maximumWallTimeMs: 5000,
      coarseFraction: 0.45,
      refinementRounds: 6,
    },
    ...overrides,
  };
}

function verified(result: SolverResult) {
  return result.solutions.filter((candidate) => candidate.hit);
}

describe('deterministic inverse projectile solver', () => {
  it('finds two complementary low and high ballistic basins with fixed power', () => {
    const result = solveProjectile(request());
    expect(verified(result).length).toBeGreaterThanOrEqual(2);
    expect(new Set(verified(result).map((c) => c.arc))).toEqual(new Set(['low', 'high']));
    for (const candidate of verified(result)) {
      expect(
        Math.min(Math.abs(candidate.angleDegrees - 30), Math.abs(candidate.angleDegrees - 60)),
      ).toBeLessThan(5);
      expect(candidate.power).toBe(40);
    }
  });

  it('does not invent a high arc when the angular interval excludes it', () => {
    const result = solveProjectile(
      request(scenario(), { angleRange: { minimum: 20, maximum: 40 } }),
    );
    expect(verified(result).length).toBeGreaterThan(0);
    expect(verified(result).every((candidate) => candidate.arc === 'undetermined')).toBe(true);
  });

  it('supports different available powers', () => {
    const result = solveProjectile(
      request(scenario(), { powerRange: { minimum: 35, maximum: 55 } }),
    );
    expect(verified(result).length).toBeGreaterThan(0);
    expect(
      result.solutions.every((candidate) => candidate.power >= 35 && candidate.power <= 55),
    ).toBe(true);
  });

  it('reports no observed solution without claiming impossibility', () => {
    const simulation = scenario({
      power: 10,
      powerModel: {
        kind: 'linear',
        baseSpeed: 0,
        speedPerPowerUnit: 1,
        minimumPower: 0,
        maximumPower: 15,
      },
    });
    const result = solveProjectile(
      request(simulation, {
        powerRange: { minimum: 10, maximum: 15 },
      }),
    );
    expect(result.status).toBe('no-solution');
    expect(result.messages.some((m) => m.code === 'no-observed-hit')).toBe(true);
  });

  it.each([
    { kind: 'acceleration' as const, magnitude: 1, directionDegrees: 0 },
    { kind: 'acceleration' as const, magnitude: 1, directionDegrees: 90 },
    { kind: 'acceleration' as const, magnitude: 1, directionDegrees: 180 },
  ])('handles horizontal and vertical wind %j', (wind) => {
    const simulation = scenario({
      environment: { gravity: 9.81, additionalAcceleration: { x: 0, y: 0 }, wind },
    });
    const result = solveProjectile(request(simulation));
    expect(verified(result).length).toBeGreaterThan(0);
  });

  it('handles linear aerodynamic drag', () => {
    const simulation = scenario({
      environment: {
        gravity: 9.81,
        additionalAcceleration: { x: 0, y: 0 },
        wind: {
          kind: 'linear-drag',
          magnitude: 0,
          directionDegrees: 0,
          dragCoefficientPerSecond: 0.12,
        },
      },
    });
    const forward = simulateProjectile({
      ...simulation,
      launchAngleDegrees: 35,
      power: 40,
      collisions: { groundY: 0, terrain: [], targets: [] },
    });
    const destination = { x: forward.horizontalRange, y: 1 };
    const testSimulation = {
      ...simulation,
      collisions: {
        groundY: 0,
        terrain: [],
        targets: [{ id: 'goal', center: destination, radius: 4 }],
      },
    };
    expect(verified(solveProjectile(request(testSimulation))).length).toBeGreaterThan(0);
  });

  it('does not treat a blocked target as a hit', () => {
    const blocked = scenario({
      collisions: {
        groundY: 0,
        terrain: [{ start: { x: 25, y: 0 }, end: { x: 25, y: 450 } }],
        targets: [{ id: 'goal', center: { x: 140, y: 1 }, radius: 3 }],
      },
    });
    const result = solveProjectile(request(blocked));
    expect(verified(result)).toHaveLength(0);
    expect(result.status).toBe('no-solution');
  });

  it('can hit a small circular target with local refinement', () => {
    const small = scenario({
      collisions: {
        groundY: 0,
        terrain: [],
        targets: [{ id: 'goal', center: { x: 140, y: 1 }, radius: 0.65 }],
      },
    });
    const result = solveProjectile(request(small));
    expect(verified(result).length).toBeGreaterThan(0);
  });

  it('rejects invalid ranges, NaN, missing targets, invalid physics, and budgets', () => {
    const invalid = [
      { angleRange: { minimum: 50, maximum: 10 } },
      { angleRange: { minimum: NaN, maximum: 60 } },
      { powerRange: { minimum: -1, maximum: 90 } },
      { targetId: 'absent' },
      { requestedSolutions: 17 },
      { budgets: { maximumEvaluations: 0 } },
      { budgets: { maximumWallTimeMs: 5001 } },
      { budgets: { maximumEvaluations: 4097 } },
      { budgets: { coarseFraction: NaN } },
      { simulation: scenario({ timeStepSeconds: 0 }) },
    ] satisfies Array<Partial<SolverInput>>;
    for (const overrides of invalid) {
      const result = solveProjectile(request(scenario(), overrides));
      expect(result.status).toBe('invalid-input');
      expect(result.evaluatedCandidates).toBe(0);
    }
  });

  it('reserves full simulations and never reports an unverified provisional hit', () => {
    const aim = scenario({
      collisions: {
        groundY: 0,
        terrain: [],
        targets: [{ id: 'goal', center: { x: 140, y: 0.7140376865 }, radius: 0.5 }],
      },
    });
    const limited = request(aim, {
      angleRange: { minimum: 20, maximum: 40 },
      requestedSolutions: 1,
      budgets: {
        maximumEvaluations: 4,
        maximumWallTimeMs: 5000,
        coarseFraction: 0.75,
        refinementRounds: 4,
      },
    });
    const result = solveProjectile(limited);
    expect(result.coarseEvaluations).toBe(3);
    expect(result.refinementEvaluations).toBe(0);
    expect(result.verificationEvaluations).toBe(1);
    expect(result.evaluatedCandidates).toBe(4);
    expect(verified(result).length).toBe(1);
    expect(verified(result)[0]?.verifiedWithFullSimulation).toBe(true);
    const impossibleToVerify = solveProjectile({
      ...limited,
      angleRange: { minimum: 30, maximum: 30 },
      budgets: {
        maximumEvaluations: 1,
        maximumWallTimeMs: 5000,
        coarseFraction: 1,
        refinementRounds: 1,
      },
    });
    expect(impossibleToVerify.status).toBe('budget-exhausted');
    expect(impossibleToVerify.evaluatedCandidates).toBe(1);
    expect(impossibleToVerify.solutions.every((c) => !c.hit)).toBe(true);
  });

  it('finds a tiny target only after refining coarse misses', () => {
    const target = {
      x: 140,
      y:
        140 * Math.tan((32.5 * Math.PI) / 180) -
        (9.81 * 140 * 140) / (2 * 40 * 40 * Math.cos((32.5 * Math.PI) / 180) ** 2),
    };
    const input = request(
      scenario({
        collisions: {
          groundY: 0,
          terrain: [],
          targets: [{ id: 'goal', center: target, radius: 0.2 }],
        },
      }),
      {
        angleRange: { minimum: 20, maximum: 40 },
        requestedSolutions: 1,
        budgets: {
          maximumEvaluations: 40,
          maximumWallTimeMs: 5000,
          coarseFraction: 0.08,
          refinementRounds: 8,
        },
      },
    );
    const progress: Array<{ phase: string; hitCount: number }> = [];
    const result = solveProjectile(input, {
      onProgress: (p) => progress.push({ phase: p.phase, hitCount: p.hitCount }),
    });
    expect(result.coarseEvaluations).toBe(3);
    expect(progress.find((p) => p.phase === 'refinement')?.hitCount).toBe(0);
    expect(result.refinementEvaluations).toBeGreaterThan(0);
    expect(verified(result).length).toBe(1);
    expect(Math.abs(verified(result)[0]!.angleDegrees - 32.5)).toBeLessThan(0.3);
    expect(result.verificationEvaluations).toBeGreaterThan(0);
  });

  it('stops at the evaluation limit and returns useful partial candidates', () => {
    const result = solveProjectile(
      request(scenario(), {
        angleRange: { minimum: 30, maximum: 30 },
        powerRange: { minimum: 40, maximum: 40 },
        budgets: {
          maximumEvaluations: 1,
          maximumWallTimeMs: 5000,
          coarseFraction: 1,
          refinementRounds: 6,
        },
      }),
    );
    expect(result.status).toBe('budget-exhausted');
    expect(result.exhaustedBudget).toBe('evaluations');
    expect(result.evaluatedCandidates).toBe(1);
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(result.solutions.every((candidate) => !candidate.hit)).toBe(true);
  });

  it('stops at the time limit using an injected monotonically advancing clock', () => {
    let clock = 0;
    const result = solveProjectile(
      request(scenario(), {
        budgets: {
          maximumEvaluations: 320,
          maximumWallTimeMs: 80,
          coarseFraction: 0.45,
          refinementRounds: 6,
        },
      }),
      {
        now: () => {
          clock += 10;
          return clock;
        },
      },
    );
    expect(result.status).toBe('budget-exhausted');
    expect(result.exhaustedBudget).toBe('time');
    expect(result.evaluatedCandidates).toBeLessThan(320);
    expect(result.solutions.length).toBeGreaterThan(0);
  });

  it('honors cancellation before evaluating another candidate', () => {
    let count = 0;
    const result = solveProjectile(request(), { isCancelled: () => ++count > 7 });
    expect(result.status).toBe('cancelled');
    expect(result.evaluatedCandidates).toBeLessThan(7);
    expect(result.stopReason).toBe('cancelled');
  });

  it('is repeatable and does not evaluate duplicate parameter combinations', () => {
    const input = request(scenario(), {
      angleRange: { minimum: 30, maximum: 30 },
      powerRange: { minimum: 40, maximum: 40 },
    });
    const first = solveProjectile(input, { now: () => 0 });
    const second = solveProjectile(input, { now: () => 0 });
    expect(first).toEqual(second);
    expect(first.coarseEvaluations + first.refinementEvaluations).toBe(1);
    expect(first.verificationEvaluations).toBeLessThanOrEqual(1);
  });

  it('reports monotonic progress without a React dependency', () => {
    const updates: number[] = [];
    solveProjectile(
      request(scenario(), {
        budgets: {
          maximumEvaluations: 32,
          maximumWallTimeMs: 5000,
          coarseFraction: 0.5,
          refinementRounds: 2,
        },
      }),
      { onProgress: (p) => updates.push(p.evaluatedCandidates) },
    );
    expect(updates.length).toBeGreaterThan(0);
    expect(updates).toEqual([...updates].sort((a, b) => a - b));
  });

  it('revalidates every reported hit with the full physical simulation', () => {
    const input = request();
    const result = solveProjectile(input);
    for (const candidate of verified(result)) {
      expect(candidate.verifiedWithFullSimulation).toBe(true);
      const full = simulateProjectile({
        ...input.simulation,
        launchAngleDegrees: candidate.angleDegrees,
        power: candidate.power,
      });
      expect(full.terminationReason).toBe('target-impact');
      expect(full.impact?.targetId).toBe('goal');
      expect(full.flightTimeSeconds).toBeCloseTo(candidate.flightTimeSeconds, 8);
    }
  });
});
