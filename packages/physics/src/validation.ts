import type { Vec2 } from '@dragonballistics/shared';
import type { SimulationInput, SimulationMessage } from './types';

const MAXIMUM_ITERATION_LIMIT = 250_000;

export interface ValidationResult {
  errors: SimulationMessage[];
  warnings: SimulationMessage[];
}

export function validateSimulationInput(input: SimulationInput): ValidationResult {
  const errors: SimulationMessage[] = [];
  const warnings: SimulationMessage[] = [];
  const requireFinite = (value: number, field: string) => {
    if (!Number.isFinite(value)) {
      errors.push({ code: 'non-finite-value', message: `${field} debe ser un numero finito.` });
    }
  };
  const requireFiniteVector = (value: Vec2, field: string) => {
    requireFinite(value.x, `${field}.x`);
    requireFinite(value.y, `${field}.y`);
  };

  requireFiniteVector(input.launchPosition, 'launchPosition');
  requireFinite(input.launchAngleDegrees, 'launchAngleDegrees');
  requireFinite(input.power, 'power');
  requireFinite(input.timeStepSeconds, 'timeStepSeconds');
  requireFinite(input.maximumTimeSeconds, 'maximumTimeSeconds');
  requireFinite(input.maximumIterations, 'maximumIterations');
  requireFinite(input.environment.gravity, 'environment.gravity');
  requireFiniteVector(
    input.environment.additionalAcceleration,
    'environment.additionalAcceleration',
  );

  if (input.timeStepSeconds <= 0 || input.timeStepSeconds > 1) {
    errors.push({
      code: 'invalid-time-step',
      message: 'timeStepSeconds debe estar en el intervalo (0, 1].',
    });
  } else if (input.timeStepSeconds > 0.1) {
    warnings.push({
      code: 'coarse-time-step',
      message: 'Un paso mayor a 0.1 s puede reducir la precision de colision y trayectoria.',
    });
  }
  if (input.maximumTimeSeconds <= 0 || input.maximumTimeSeconds > 600) {
    errors.push({
      code: 'invalid-maximum-time',
      message: 'maximumTimeSeconds debe estar en el intervalo (0, 600].',
    });
  }
  if (
    !Number.isInteger(input.maximumIterations) ||
    input.maximumIterations <= 0 ||
    input.maximumIterations > MAXIMUM_ITERATION_LIMIT
  ) {
    errors.push({
      code: 'invalid-maximum-iterations',
      message: `maximumIterations debe ser entero entre 1 y ${MAXIMUM_ITERATION_LIMIT}.`,
    });
  }
  if (
    input.maximumIterations > 0 &&
    input.timeStepSeconds > 0 &&
    input.maximumIterations * input.timeStepSeconds < input.maximumTimeSeconds
  ) {
    warnings.push({
      code: 'iteration-limit-precedes-time-limit',
      message: 'El limite de iteraciones puede detener la simulacion antes del tiempo maximo.',
    });
  }
  if (input.environment.gravity < 0) {
    errors.push({
      code: 'negative-gravity',
      message: 'gravity representa una magnitud y no puede ser negativa.',
    });
  } else if (input.environment.gravity === 0) {
    warnings.push({ code: 'zero-gravity', message: 'La simulacion se ejecuta sin gravedad.' });
  }

  validatePower(input, errors);
  validateWind(input, errors);
  validateBounds(input, errors);
  validateCollisions(input, errors);
  return { errors, warnings };
}

function validatePower(input: SimulationInput, errors: SimulationMessage[]) {
  const model = input.powerModel;
  for (const [field, value] of [
    ['baseSpeed', model.baseSpeed],
    ['speedPerPowerUnit', model.speedPerPowerUnit],
    ['minimumPower', model.minimumPower],
    ['maximumPower', model.maximumPower],
  ] as const) {
    if (!Number.isFinite(value)) {
      errors.push({ code: 'invalid-power-model', message: `${field} debe ser finito.` });
    }
  }
  if (model.baseSpeed < 0 || model.speedPerPowerUnit < 0) {
    errors.push({
      code: 'invalid-power-model',
      message: 'La velocidad base y la escala de potencia no pueden ser negativas.',
    });
  }
  if (model.minimumPower > model.maximumPower) {
    errors.push({
      code: 'invalid-power-range',
      message: 'minimumPower no puede superar maximumPower.',
    });
  }
  if (input.power < model.minimumPower || input.power > model.maximumPower) {
    errors.push({
      code: 'power-out-of-range',
      message: 'power esta fuera del intervalo configurado.',
    });
  }
}

function validateWind(input: SimulationInput, errors: SimulationMessage[]) {
  const wind = input.environment.wind;
  if (wind.kind === 'none') return;
  if (!Number.isFinite(wind.magnitude) || wind.magnitude < 0) {
    errors.push({
      code: 'invalid-wind',
      message: 'La magnitud del viento debe ser finita y no negativa.',
    });
  }
  if (!Number.isFinite(wind.directionDegrees)) {
    errors.push({ code: 'invalid-wind', message: 'La direccion del viento debe ser finita.' });
  }
  if (
    wind.kind === 'linear-drag' &&
    (!Number.isFinite(wind.dragCoefficientPerSecond) || wind.dragCoefficientPerSecond < 0)
  ) {
    errors.push({
      code: 'invalid-wind-drag',
      message: 'El coeficiente de arrastre debe ser finito y no negativo.',
    });
  }
}

function validateBounds(input: SimulationInput, errors: SimulationMessage[]) {
  const bounds = input.bounds;
  for (const [field, value] of Object.entries(bounds)) {
    if (!Number.isFinite(value)) {
      errors.push({ code: 'invalid-bounds', message: `${field} debe ser finito.` });
    }
  }
  if (bounds.minimumX >= bounds.maximumX || bounds.minimumY >= bounds.maximumY) {
    errors.push({
      code: 'invalid-bounds',
      message: 'Los limites minimos deben ser menores que los maximos.',
    });
  }
  const point = input.launchPosition;
  if (
    point.x < bounds.minimumX ||
    point.x > bounds.maximumX ||
    point.y < bounds.minimumY ||
    point.y > bounds.maximumY
  ) {
    errors.push({
      code: 'launch-out-of-bounds',
      message: 'El punto de lanzamiento esta fuera del mundo.',
    });
  }
}

function validateCollisions(input: SimulationInput, errors: SimulationMessage[]) {
  const { collisions } = input;
  if (collisions.groundY !== undefined) {
    if (!Number.isFinite(collisions.groundY)) {
      errors.push({ code: 'invalid-ground', message: 'groundY debe ser finito.' });
    } else if (input.launchPosition.y < collisions.groundY) {
      errors.push({
        code: 'launch-below-ground',
        message: 'El lanzamiento no puede comenzar bajo el suelo.',
      });
    }
  }
  collisions.terrain.forEach((segment, index) => {
    if (![segment.start.x, segment.start.y, segment.end.x, segment.end.y].every(Number.isFinite)) {
      errors.push({
        code: 'invalid-terrain',
        message: `El segmento de terreno ${index} no es finito.`,
      });
    }
    if (segment.start.x === segment.end.x && segment.start.y === segment.end.y) {
      errors.push({
        code: 'degenerate-terrain',
        message: `El segmento de terreno ${index} no tiene longitud.`,
      });
    }
  });
  const targetIds = new Set<string>();
  collisions.targets.forEach((target, index) => {
    if (!target.id.trim() || targetIds.has(target.id)) {
      errors.push({
        code: 'invalid-target-id',
        message: `El objetivo ${index} necesita un id unico.`,
      });
    }
    targetIds.add(target.id);
    if (
      ![target.center.x, target.center.y, target.radius].every(Number.isFinite) ||
      target.radius <= 0
    ) {
      errors.push({
        code: 'invalid-target',
        message: `El objetivo ${target.id || index} es invalido.`,
      });
    }
  });
}
