import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput } from '@dragonballistics/physics';
import { createDefaultSimulationControls } from '@dragonballistics/shared';
import { buildSimulationInput, solverScenarioSignature } from './simulation-input';
import { initialSearchForm, isConfirmedHit, validateSolverForm } from './inverse-solver-model';

describe('inverse UI physics contract', () => {
  const controls = createDefaultSimulationControls();
  const launch = { x: 0, y: 0 };
  const target = { x: 140, y: 1 };

  it('shares the visible physics model and target radius, including wind and temporal step', () => {
    const input = buildSimulationInput(launch, target, {
      ...controls,
      windModel: 'linear-drag',
      windMagnitude: 2.4,
      windDirectionDegrees: 105,
      dragCoefficientPerSecond: 0.08,
      timeStepSeconds: 0.01,
    });
    const base = createDefaultSimulationInput(launch, target);
    expect(input.collisions.targets[0]).toEqual(base.collisions.targets[0]);
    expect(input.collisions.targets[0]?.id).toBe('workspace-target');
    expect(input.collisions.targets[0]?.radius).toBe(10);
    expect(input.environment.wind).toEqual({
      kind: 'linear-drag',
      magnitude: 2.4,
      directionDegrees: 105,
      dragCoefficientPerSecond: 0.08,
    });
    expect(input.timeStepSeconds).toBe(0.01);
  });

  it('invalidates on scenario changes without invalidating for display-only comparisons', () => {
    const first = buildSimulationInput(launch, target, controls);
    const comparisonOnly = buildSimulationInput(launch, target, {
      ...controls,
      comparison: { enabled: true, angleDegrees: 31, power: 48 },
    });
    expect(solverScenarioSignature(first)).toBe(solverScenarioSignature(comparisonOnly));
    expect(solverScenarioSignature(first)).not.toBe(
      solverScenarioSignature(buildSimulationInput(launch, { ...target, x: 150 }, controls)),
    );
    expect(solverScenarioSignature(first)).not.toBe(
      solverScenarioSignature(buildSimulationInput(launch, target, { ...controls, gravity: 10.2 })),
    );
    expect(solverScenarioSignature(first)).not.toBe(
      solverScenarioSignature(
        buildSimulationInput(launch, target, { ...controls, angleDegrees: 51 }),
      ),
    );
    expect(solverScenarioSignature(first)).not.toBe(
      solverScenarioSignature(buildSimulationInput(launch, target, { ...controls, power: 49 })),
    );
  });

  it('accepts power fixed to one value and rejects malformed search limits', () => {
    const simulation = buildSimulationInput(launch, target, controls);
    const base = initialSearchForm(simulation);
    expect(
      validateSolverForm({ ...base, powerMin: '40', powerMax: '40' }, simulation).input?.powerRange,
    ).toEqual({ minimum: 40, maximum: 40 });
    for (const form of [
      { ...base, angleMin: '' },
      { ...base, angleMin: '50', angleMax: '20' },
      { ...base, powerMin: '-1' },
      { ...base, evaluations: '4097' },
      { ...base, evaluations: '0' },
      { ...base, timeMs: '5001' },
      { ...base, solutions: '0' },
      { ...base, solutions: '17' },
      { ...base, targetId: 'missing' },
      { ...base, powerMax: 'Infinity' },
    ]) {
      expect(validateSolverForm(form, simulation).input).toBeNull();
      expect(validateSolverForm(form, simulation).error).toBeTruthy();
    }
  });

  it('does not equate zero surface distance with confirmed physical impact', () => {
    const candidate = {
      angleDegrees: 30,
      power: 40,
      arc: 'undetermined' as const,
      hit: false,
      verifiedWithFullSimulation: false,
      score: 0,
      missDistance: 0,
      closestApproach: null,
      impact: null,
      flightTimeSeconds: 2,
      maximumHeight: 10,
      terminationReason: 'terrain-impact' as const,
    };
    expect(isConfirmedHit(candidate, 'workspace-target')).toBe(false);
    expect(
      isConfirmedHit(
        {
          ...candidate,
          hit: true,
          verifiedWithFullSimulation: true,
          terminationReason: 'target-impact',
          impact: {
            kind: 'target',
            targetId: 'wrong-target',
            elapsedSeconds: 2,
            point: { x: 140, y: 1 },
            normal: { x: 0, y: 1 },
          },
        },
        'workspace-target',
      ),
    ).toBe(false);
    expect(
      isConfirmedHit(
        {
          ...candidate,
          hit: true,
          verifiedWithFullSimulation: true,
          terminationReason: 'target-impact',
          impact: {
            kind: 'target',
            targetId: 'workspace-target',
            elapsedSeconds: 2,
            point: { x: 140, y: 1 },
            normal: { x: 0, y: 1 },
          },
        },
        'workspace-target',
      ),
    ).toBe(true);
  });
});
