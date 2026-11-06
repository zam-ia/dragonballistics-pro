import { z } from 'zod';

export const Vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const WorkspaceIdSchema = z.enum([
  'workspace-1',
  'workspace-2',
  'workspace-3',
  'workspace-4',
]);

export const SimulationControlsSchema = z.object({
  angleDegrees: z.number().finite().min(-180).max(180),
  power: z.number().finite().min(0).max(120),
  gravity: z.number().finite().min(0).max(50),
  windModel: z.enum(['acceleration', 'linear-drag']),
  windMagnitude: z.number().finite().min(0).max(50),
  windDirectionDegrees: z.number().finite(),
  dragCoefficientPerSecond: z.number().finite().min(0).max(5),
  integrator: z.enum(['rk4', 'semi-implicit-euler']),
  timeStepSeconds: z.number().finite().min(0.001).max(0.2),
  comparison: z.object({
    enabled: z.boolean(),
    angleDegrees: z.number().finite().min(-180).max(180),
    power: z.number().finite().min(0).max(120),
  }),
});

export function createDefaultSimulationControls(): SimulationControls {
  return {
    angleDegrees: 45,
    power: 75,
    gravity: 9.81,
    windModel: 'acceleration',
    windMagnitude: 0,
    windDirectionDegrees: 0,
    dragCoefficientPerSecond: 0.05,
    integrator: 'rk4',
    timeStepSeconds: 0.02,
    comparison: { enabled: false, angleDegrees: 60, power: 75 },
  };
}

export const WorkspaceSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string().trim().min(1).max(48),
  launch: Vec2Schema,
  target: Vec2Schema,
  simulation: SimulationControlsSchema.default(createDefaultSimulationControls),
  updatedAt: z.iso.datetime(),
});

export const AppPreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  density: z.enum(['comfortable', 'compact']),
  showGrid: z.boolean(),
  reducedMotion: z.boolean(),
});

export const ExportBundleSchema = z.object({
  format: z.literal('dragonballistics-workspaces'),
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  activeWorkspaceId: WorkspaceIdSchema,
  workspaces: z.array(WorkspaceSchema).length(4),
  preferences: AppPreferencesSchema,
});

export type Vec2 = z.infer<typeof Vec2Schema>;
export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;
export type SimulationControls = z.infer<typeof SimulationControlsSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;
export type ExportBundle = z.infer<typeof ExportBundleSchema>;
