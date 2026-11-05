import type { Vec2 } from '@dragonballistics/shared';
import { Vec2Schema } from '@dragonballistics/shared';
import { z } from 'zod';

export const ExperimentObservationSchema = z.object({
  id: z.string().uuid(),
  engineVersion: z.string().trim().min(1),
  mobileProfileId: z.string().trim().min(1),
  shotProfileId: z.string().trim().min(1),
  predictedImpact: Vec2Schema,
  observedImpact: Vec2Schema,
  confidence: z.number().min(0).max(1),
  validated: z.boolean(),
  observedAt: z.iso.datetime(),
});

export interface ObservationError {
  horizontal: number;
  vertical: number;
  total: number;
}

export function calculateObservationError(predicted: Vec2, observed: Vec2): ObservationError {
  const horizontal = observed.x - predicted.x;
  const vertical = observed.y - predicted.y;
  return { horizontal, vertical, total: Math.hypot(horizontal, vertical) };
}
