import type { AppPreferences, Workspace, WorkspaceId } from '@dragonballistics/shared';
import Dexie, { type EntityTable } from 'dexie';

export interface SettingsRecord {
  key: 'app';
  activeWorkspaceId: WorkspaceId;
  preferences: AppPreferences;
}

class DragonBallisticsDatabase extends Dexie {
  workspaces!: EntityTable<Workspace, 'id'>;
  settings!: EntityTable<SettingsRecord, 'key'>;

  public constructor() {
    super('dragonballistics-pro');
    this.version(1).stores({
      workspaces: 'id, updatedAt',
      settings: 'key',
    });
  }
}

export const database = new DragonBallisticsDatabase();
