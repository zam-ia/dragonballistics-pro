import { createDefaultSimulationInput, type SimulationInput } from '@dragonballistics/physics';
import type { SimulationControls, Vec2, Workspace } from '@dragonballistics/shared';

/** One authoritative scenario for the visible trajectory, solver and comparison. */
export function buildSimulationInput(
  launchPosition: Vec2,
  targetPosition: Vec2,
  controls: SimulationControls,
): SimulationInput {
  const base = createDefaultSimulationInput(launchPosition, targetPosition);
  return {
    ...base,
    launchAngleDegrees: controls.angleDegrees,
    power: controls.power,
    integrator: controls.integrator,
    timeStepSeconds: controls.timeStepSeconds,
    environment: {
      gravity: controls.gravity,
      additionalAcceleration: { x: 0, y: 0 },
      wind:
        controls.windModel === 'acceleration'
          ? {
              kind: 'acceleration',
              magnitude: controls.windMagnitude,
              directionDegrees: controls.windDirectionDegrees,
            }
          : {
              kind: 'linear-drag',
              magnitude: controls.windMagnitude,
              directionDegrees: controls.windDirectionDegrees,
              dragCoefficientPerSecond: controls.dragCoefficientPerSecond,
            },
    },
  };
}

/** Signature ignores name, timestamps and comparison (none affects the inverse physics).
 * Angle and current power are intentionally included: changing either invalidates the
 * displayed job, even though the solver will override them with candidate parameters.
 */
export function solverScenarioSignature(input: SimulationInput): string {
  return JSON.stringify(input);
}

export function workspacePhysicsSignature(workspace: Workspace): string {
  return solverScenarioSignature(
    buildSimulationInput(workspace.launch, workspace.target, workspace.simulation),
  );
}
