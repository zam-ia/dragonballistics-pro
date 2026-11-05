import type { Vec2 } from '@dragonballistics/shared';
import type { KinematicState } from './types';

export function analyticalStateAt(
  initialState: Readonly<KinematicState>,
  constantAcceleration: Vec2,
  elapsedSeconds: number,
): KinematicState {
  const halfTimeSquared = 0.5 * elapsedSeconds * elapsedSeconds;
  return {
    position: {
      x:
        initialState.position.x +
        initialState.velocity.x * elapsedSeconds +
        constantAcceleration.x * halfTimeSquared,
      y:
        initialState.position.y +
        initialState.velocity.y * elapsedSeconds +
        constantAcceleration.y * halfTimeSquared,
    },
    velocity: {
      x: initialState.velocity.x + constantAcceleration.x * elapsedSeconds,
      y: initialState.velocity.y + constantAcceleration.y * elapsedSeconds,
    },
    elapsedSeconds: initialState.elapsedSeconds + elapsedSeconds,
  };
}
