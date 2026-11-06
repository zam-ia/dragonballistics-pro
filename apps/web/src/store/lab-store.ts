import {
  AppPreferencesSchema,
  createDefaultWorkspaces,
  defaultPreferences,
  SimulationControlsSchema,
  type AppPreferences,
  type ExportBundle,
  type SimulationControls,
  type Vec2,
  type Workspace,
  type WorkspaceId,
  WorkspaceSchema,
} from '@dragonballistics/shared';
import { create } from 'zustand';
import { database, type SettingsRecord } from '../db/database';

interface LabState {
  initialized: boolean;
  persistenceError: string | null;
  activeWorkspaceId: WorkspaceId;
  workspaces: Workspace[];
  preferences: AppPreferences;
  initialize: () => Promise<void>;
  setActiveWorkspace: (id: WorkspaceId) => void;
  renameActiveWorkspace: (name: string) => void;
  updateActivePoint: (kind: 'launch' | 'target', point: Vec2) => void;
  updateActiveSimulation: (patch: Partial<SimulationControls>) => void;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  replaceFromImport: (bundle: ExportBundle) => Promise<void>;
  clearPersistenceError: () => void;
}

const initialWorkspaces = createDefaultWorkspaces();
const workspaceWriteQueues = new Map<WorkspaceId, Promise<void>>();
let settingsWriteQueue: Promise<void> = Promise.resolve();

function persistSettings(state: Pick<LabState, 'activeWorkspaceId' | 'preferences'>) {
  const settings: SettingsRecord = {
    key: 'app',
    activeWorkspaceId: state.activeWorkspaceId,
    preferences: state.preferences,
  };
  const write = settingsWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await database.settings.put(settings);
    });
  settingsWriteQueue = write;
  return write;
}

function persistWorkspace(workspace: Workspace) {
  const previous = workspaceWriteQueues.get(workspace.id) ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(async () => {
      await database.workspaces.put(workspace);
    });
  workspaceWriteQueues.set(workspace.id, write);
  void write.then(
    () => clearCompletedWorkspaceWrite(workspace.id, write),
    () => clearCompletedWorkspaceWrite(workspace.id, write),
  );
  return write;
}

function clearCompletedWorkspaceWrite(id: WorkspaceId, write: Promise<void>) {
  if (workspaceWriteQueues.get(id) === write) workspaceWriteQueues.delete(id);
}

export async function waitForPendingPersistence() {
  await Promise.all([
    settingsWriteQueue.catch(() => undefined),
    ...[...workspaceWriteQueues.values()].map((write) => write.catch(() => undefined)),
  ]);
}

export function recoverStoredWorkspaces(
  storedRecords: readonly unknown[],
  defaults = createDefaultWorkspaces(),
): Workspace[] {
  return defaults.map((fallback) => {
    const stored = storedRecords.find(
      (record) =>
        typeof record === 'object' &&
        record !== null &&
        'id' in record &&
        record.id === fallback.id,
    );
    const parsed = WorkspaceSchema.safeParse(stored);
    return parsed.success ? parsed.data : fallback;
  });
}

export const useLabStore = create<LabState>((set, get) => ({
  initialized: false,
  persistenceError: null,
  activeWorkspaceId: 'workspace-1',
  workspaces: initialWorkspaces,
  preferences: defaultPreferences,

  initialize: async () => {
    if (get().initialized) return;

    try {
      const [storedWorkspaces, storedSettings] = await Promise.all([
        database.workspaces.toArray(),
        database.settings.get('app'),
      ]);
      const validWorkspaces = recoverStoredWorkspaces(storedWorkspaces);
      const preferencesResult = AppPreferencesSchema.safeParse(storedSettings?.preferences);
      const activeWorkspaceExists = validWorkspaces.some(
        (workspace) => workspace.id === storedSettings?.activeWorkspaceId,
      );

      set({
        initialized: true,
        workspaces: validWorkspaces,
        preferences: preferencesResult.success ? preferencesResult.data : defaultPreferences,
        activeWorkspaceId: activeWorkspaceExists
          ? (storedSettings?.activeWorkspaceId ?? 'workspace-1')
          : 'workspace-1',
      });

      await database.workspaces.bulkPut(validWorkspaces);
      await persistSettings(get());
    } catch (error) {
      set({
        initialized: true,
        persistenceError:
          error instanceof Error ? error.message : 'No se pudo abrir el almacenamiento local.',
      });
    }
  },

  setActiveWorkspace: (activeWorkspaceId) => {
    set({ activeWorkspaceId });
    void persistSettings(get()).catch((error: unknown) => {
      set({ persistenceError: error instanceof Error ? error.message : 'Error al guardar.' });
    });
  },

  renameActiveWorkspace: (name) => {
    const cleanName = name.trim().slice(0, 48);
    if (!cleanName) return;
    const state = get();
    const updatedAt = new Date().toISOString();
    let changed: Workspace | undefined;
    const workspaces = state.workspaces.map((workspace) => {
      if (workspace.id !== state.activeWorkspaceId) return workspace;
      changed = { ...workspace, name: cleanName, updatedAt };
      return changed;
    });
    set({ workspaces });
    if (changed) {
      void persistWorkspace(changed).catch((error: unknown) => {
        set({ persistenceError: error instanceof Error ? error.message : 'Error al guardar.' });
      });
    }
  },

  updateActivePoint: (kind, point) => {
    const state = get();
    const updatedAt = new Date().toISOString();
    let changed: Workspace | undefined;
    const workspaces = state.workspaces.map((workspace) => {
      if (workspace.id !== state.activeWorkspaceId) return workspace;
      changed = { ...workspace, [kind]: point, updatedAt };
      return changed;
    });
    set({ workspaces });
    if (changed) {
      void persistWorkspace(changed).catch((error: unknown) => {
        set({ persistenceError: error instanceof Error ? error.message : 'Error al guardar.' });
      });
    }
  },

  updateActiveSimulation: (patch) => {
    const state = get();
    const current = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
    if (!current) return;
    const result = SimulationControlsSchema.safeParse({ ...current.simulation, ...patch });
    if (!result.success) return;
    const updatedAt = new Date().toISOString();
    const changed: Workspace = { ...current, simulation: result.data, updatedAt };
    set({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === state.activeWorkspaceId ? changed : workspace,
      ),
    });
    void persistWorkspace(changed).catch((error: unknown) => {
      set({ persistenceError: error instanceof Error ? error.message : 'Error al guardar.' });
    });
  },

  updatePreferences: (patch) => {
    const result = AppPreferencesSchema.safeParse({ ...get().preferences, ...patch });
    if (!result.success) return;
    set({ preferences: result.data });
    void persistSettings(get()).catch((error: unknown) => {
      set({ persistenceError: error instanceof Error ? error.message : 'Error al guardar.' });
    });
  },

  replaceFromImport: async (bundle) => {
    await waitForPendingPersistence();
    await database.transaction('rw', database.workspaces, database.settings, async () => {
      await database.workspaces.clear();
      await database.workspaces.bulkPut(bundle.workspaces);
      await database.settings.put({
        key: 'app',
        activeWorkspaceId: bundle.activeWorkspaceId,
        preferences: bundle.preferences,
      });
    });
    set({
      activeWorkspaceId: bundle.activeWorkspaceId,
      workspaces: bundle.workspaces,
      preferences: bundle.preferences,
      persistenceError: null,
    });
  },

  clearPersistenceError: () => set({ persistenceError: null }),
}));
