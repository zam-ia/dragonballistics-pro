import { describe, expect, it } from 'vitest';
import { ExportBundleSchema, WorkspaceSchema } from './schemas';
import { createDefaultWorkspaces, defaultPreferences } from './defaults';

describe('shared schemas', () => {
  it('creates exactly four valid workspaces', () => {
    const workspaces = createDefaultWorkspaces('2026-11-05T00:00:00.000Z');

    expect(workspaces).toHaveLength(4);
    for (const workspace of workspaces) {
      expect(WorkspaceSchema.parse(workspace)).toEqual(workspace);
    }
  });

  it('rejects non-finite geometry values during import', () => {
    const result = ExportBundleSchema.safeParse({
      format: 'dragonballistics-workspaces',
      version: 1,
      generatedAt: '2026-11-05T00:00:00.000Z',
      activeWorkspaceId: 'workspace-1',
      workspaces: createDefaultWorkspaces().map((workspace, index) =>
        index === 0 ? { ...workspace, launch: { x: Number.NaN, y: 0 } } : workspace,
      ),
      preferences: defaultPreferences,
    });

    expect(result.success).toBe(false);
  });
});
