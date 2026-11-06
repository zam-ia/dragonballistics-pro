import {
  createDefaultSimulationControls,
  createDefaultWorkspaces,
  defaultPreferences,
  type Workspace,
  type WorkspaceId,
} from '@dragonballistics/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { database } from '../db/database';
import { recoverStoredWorkspaces, useLabStore, waitForPendingPersistence } from './lab-store';

const fixedNow = '2026-11-05T12:00:00.000Z';

describe('workspace persistence recovery', () => {
  beforeEach(async () => {
    await waitForPendingPersistence();
    await database.workspaces.clear();
    await database.settings.clear();
    useLabStore.setState({
      initialized: false,
      persistenceError: null,
      activeWorkspaceId: 'workspace-1',
      workspaces: createDefaultWorkspaces(fixedNow),
      preferences: defaultPreferences,
    });
  });

  afterAll(() => database.close());

  it('recovers each workspace independently without replacing valid siblings', () => {
    const defaults = createDefaultWorkspaces(fixedNow);
    const validFirst: Workspace = {
      ...requiredWorkspace(defaults, 'workspace-1'),
      name: 'Conservar uno',
      launch: { x: 321, y: 123 },
    };
    const validThird: Workspace = {
      ...requiredWorkspace(defaults, 'workspace-3'),
      name: 'Conservar tres',
      simulation: { ...createDefaultSimulationControls(), power: 37 },
    };
    const invalidSecond = {
      ...requiredWorkspace(defaults, 'workspace-2'),
      name: '',
      target: { x: Number.NaN, y: 4 },
    };

    const recovered = recoverStoredWorkspaces([validFirst, invalidSecond, validThird], defaults);

    expect(recovered).toHaveLength(4);
    expect(requiredWorkspace(recovered, 'workspace-1')).toEqual(validFirst);
    expect(requiredWorkspace(recovered, 'workspace-2')).toEqual(
      requiredWorkspace(defaults, 'workspace-2'),
    );
    expect(requiredWorkspace(recovered, 'workspace-3')).toEqual(validThird);
    expect(requiredWorkspace(recovered, 'workspace-4')).toEqual(
      requiredWorkspace(defaults, 'workspace-4'),
    );
  });

  it('migrates a legacy workspace, repairs only invalid records and persists the normalized set', async () => {
    const defaults = createDefaultWorkspaces(fixedNow);
    const validFirst: Workspace = {
      ...requiredWorkspace(defaults, 'workspace-1'),
      name: 'Dato valido',
      launch: { x: 777, y: 222 },
    };
    const invalidSecond = {
      ...requiredWorkspace(defaults, 'workspace-2'),
      name: '',
    };
    const legacyThird = {
      id: 'workspace-3',
      name: 'Legado sin simulacion',
      launch: { x: 30, y: 40 },
      target: { x: 80, y: 90 },
      updatedAt: fixedNow,
    } as Workspace;
    await database.workspaces.bulkPut([validFirst, invalidSecond, legacyThird]);
    await database.settings.put({
      key: 'app',
      activeWorkspaceId: 'workspace-1',
      preferences: defaultPreferences,
    });

    await useLabStore.getState().initialize();
    await waitForPendingPersistence();

    const state = useLabStore.getState();
    expect(state.workspaces).toHaveLength(4);
    expect(requiredWorkspace(state.workspaces, 'workspace-1').launch).toEqual({ x: 777, y: 222 });
    expect(requiredWorkspace(state.workspaces, 'workspace-2').name).toBe('Espacio 2');
    expect(requiredWorkspace(state.workspaces, 'workspace-3')).toMatchObject({
      name: 'Legado sin simulacion',
      simulation: createDefaultSimulationControls(),
    });
    expect(requiredWorkspace(state.workspaces, 'workspace-4').name).toBe('Espacio 4');

    const persisted = await database.workspaces.toArray();
    expect(persisted).toHaveLength(4);
    expect(requiredWorkspace(persisted, 'workspace-1').name).toBe('Dato valido');
    expect(requiredWorkspace(persisted, 'workspace-3').simulation).toEqual(
      createDefaultSimulationControls(),
    );
  });

  it('serializes rapid edits and preserves all four independent workspaces', async () => {
    await useLabStore.getState().initialize();
    const ids: WorkspaceId[] = ['workspace-1', 'workspace-2', 'workspace-3', 'workspace-4'];

    ids.forEach((id, index) => {
      useLabStore.getState().setActiveWorkspace(id);
      for (let revision = 0; revision < 12; revision += 1) {
        useLabStore.getState().renameActiveWorkspace(`Rapido ${index + 1}-${revision}`);
        useLabStore
          .getState()
          .updateActivePoint('launch', { x: index * 100 + revision, y: revision * 2 });
        useLabStore.getState().updateActiveSimulation({ power: index * 20 + revision });
      }
    });

    await waitForPendingPersistence();

    const persisted = await database.workspaces.toArray();
    expect(persisted).toHaveLength(4);
    ids.forEach((id, index) => {
      const workspace = requiredWorkspace(persisted, id);
      expect(workspace.name).toBe(`Rapido ${index + 1}-11`);
      expect(workspace.launch).toEqual({ x: index * 100 + 11, y: 22 });
      expect(workspace.simulation.power).toBe(index * 20 + 11);
    });
    expect((await database.settings.get('app'))?.activeWorkspaceId).toBe('workspace-4');
  });
});

function requiredWorkspace(workspaces: readonly Workspace[], id: WorkspaceId): Workspace {
  const workspace = workspaces.find((item) => item.id === id);
  if (!workspace) throw new Error(`Workspace ${id} missing in test fixture.`);
  return workspace;
}
