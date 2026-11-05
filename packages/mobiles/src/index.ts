import { z } from 'zod';

export const MobileProfileStatusSchema = z.enum([
  'provisional',
  'calibrating',
  'calibrated',
  'unavailable',
]);

export const ShotProfileSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  modelKind: z.enum(['single', 'multiple', 'rotating', 'split', 'special']),
  parameters: z.record(z.string(), z.number().finite()).default({}),
});

export const MobileProfileSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim(),
  status: MobileProfileStatusSchema,
  version: z.string().trim().min(1),
  source: z.object({
    label: z.string().trim().min(1),
    url: z.url().optional(),
    verifiedAt: z.iso.datetime().optional(),
  }),
  shots: z.array(ShotProfileSchema),
});

export type MobileProfile = z.infer<typeof MobileProfileSchema>;

// Deliberately empty in Phase 1: no game constants are presented without evidence.
export const mobileRegistry: readonly MobileProfile[] = [];
