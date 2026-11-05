import type { PowerModel } from './types';

export function powerToInitialSpeed(power: number, model: PowerModel): number {
  switch (model.kind) {
    case 'linear':
      return model.baseSpeed + power * model.speedPerPowerUnit;
  }
}
