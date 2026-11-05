import type { AccelerationField, SimulationEnvironment } from './types';
import { windAccelerationAt } from './wind';

export function createAccelerationField(environment: SimulationEnvironment): AccelerationField {
  return (state) => {
    const wind = windAccelerationAt(environment.wind, state);
    return {
      x: environment.additionalAcceleration.x + wind.x,
      y: environment.additionalAcceleration.y - environment.gravity + wind.y,
    };
  };
}
