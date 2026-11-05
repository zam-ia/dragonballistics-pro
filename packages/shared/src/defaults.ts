import type { AppPreferences, Workspace, WorkspaceId } from './schemas';

export const APP_NAME = 'DragonBallistics Pro';
export const APP_VERSION = '0.1.0';

export const defaultPreferences: AppPreferences = {
  theme: 'dark',
  density: 'comfortable',
  showGrid: true,
  reducedMotion: false,
};

const workspaceIds: readonly WorkspaceId[] = [
  'workspace-1',
  'workspace-2',
  'workspace-3',
  'workspace-4',
];

export function createDefaultWorkspaces(now = new Date().toISOString()): Workspace[] {
  return workspaceIds.map((id, index) => ({
    id,
    name: `Espacio ${index + 1}`,
    launch: { x: 120, y: 80 },
    target: { x: 680, y: 150 },
    updatedAt: now,
  }));
}
