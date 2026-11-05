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

export const WorkspaceSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string().trim().min(1).max(48),
  launch: Vec2Schema,
  target: Vec2Schema,
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
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;
export type ExportBundle = z.infer<typeof ExportBundleSchema>;
