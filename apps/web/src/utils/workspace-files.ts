import {
  ExportBundleSchema,
  type AppPreferences,
  type ExportBundle,
  type Workspace,
  type WorkspaceId,
} from '@dragonballistics/shared';

const MAX_IMPORT_BYTES = 1_000_000;

export function createExportBundle(input: {
  activeWorkspaceId: WorkspaceId;
  workspaces: Workspace[];
  preferences: AppPreferences;
}): ExportBundle {
  return ExportBundleSchema.parse({
    format: 'dragonballistics-workspaces',
    version: 1,
    generatedAt: new Date().toISOString(),
    ...input,
  });
}

export function downloadExportBundle(bundle: ExportBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dragonballistics-workspaces-${bundle.generatedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readExportBundle(file: File): Promise<ExportBundle> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('El archivo supera el limite de 1 MB.');
  }
  if (file.type && file.type !== 'application/json') {
    throw new Error('Selecciona un archivo JSON exportado por DragonBallistics Pro.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error('El archivo no contiene JSON valido.');
  }

  const result = ExportBundleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('El archivo no cumple el esquema DragonBallistics Pro v1.');
  }
  return result.data;
}
