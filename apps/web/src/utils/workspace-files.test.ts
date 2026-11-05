import { describe, expect, it } from 'vitest';
import { createDefaultWorkspaces, defaultPreferences } from '@dragonballistics/shared';
import { createExportBundle, readExportBundle } from './workspace-files';

describe('workspace import and export', () => {
  it('creates a versioned validated bundle', () => {
    const bundle = createExportBundle({
      activeWorkspaceId: 'workspace-2',
      workspaces: createDefaultWorkspaces(),
      preferences: defaultPreferences,
    });

    expect(bundle.format).toBe('dragonballistics-workspaces');
    expect(bundle.version).toBe(1);
    expect(bundle.workspaces).toHaveLength(4);
  });

  it('rejects an unrelated JSON file', async () => {
    const file = new File(['{"hello":"world"}'], 'other.json', { type: 'application/json' });

    await expect(readExportBundle(file)).rejects.toThrow('no cumple el esquema');
  });
});
