import type { AccelerationField, SimulationEnvironment } from './types';
import { polarVector } from './wind';

export function createAccelerationField(environment: SimulationEnvironment): AccelerationField {
  const baseX = environment.additionalAcceleration.x;
  const baseY = environment.additionalAcceleration.y - environment.gravity;
  const wind = environment.wind;

  if (wind.kind === 'none') return () => ({ x: baseX, y: baseY });

  const windVector = polarVector(wind.magnitude, wind.directionDegrees);
  if (wind.kind === 'acceleration') {
    const accelerationX = baseX + windVector.x;
    const accelerationY = baseY + windVector.y;
    return () => ({ x: accelerationX, y: accelerationY });
  }

  const drag = wind.dragCoefficientPerSecond;
  const equilibriumX = baseX + windVector.x * drag;
  const equilibriumY = baseY + windVector.y * drag;
  return (state) => ({
    x: equilibriumX - state.velocity.x * drag,
    y: equilibriumY - state.velocity.y * drag,
  });
}
