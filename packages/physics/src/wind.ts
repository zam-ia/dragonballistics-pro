import type { Vec2 } from '@dragonballistics/shared';
import type { KinematicState, WindModel } from './types';

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function normalizeDegrees(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Converts a polar magnitude into world axes. Zero degrees points along +X and
 * 90 degrees points along +Y.
 */
export function polarVector(magnitude: number, directionDegrees: number): Vec2 {
  const radians = degreesToRadians(normalizeDegrees(directionDegrees));
  return {
    x: magnitude * Math.cos(radians),
    y: magnitude * Math.sin(radians),
  };
}

export function windAccelerationAt(model: WindModel, state: Readonly<KinematicState>): Vec2 {
  switch (model.kind) {
    case 'none':
      return { x: 0, y: 0 };
    case 'acceleration':
      return polarVector(model.magnitude, model.directionDegrees);
    case 'linear-drag': {
      const airVelocity = polarVector(model.magnitude, model.directionDegrees);
      return {
        x: (airVelocity.x - state.velocity.x) * model.dragCoefficientPerSecond,
        y: (airVelocity.y - state.velocity.y) * model.dragCoefficientPerSecond,
      };
    }
  }
}
