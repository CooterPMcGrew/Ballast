// Export payload — pure builder, no I/O. Everything the user has generated
// leaves the device in one self-describing JSON document: schema id for
// future import/migration, full per-set history with timestamps (kg,
// always — the export is data, not display).

import type { UnitPreference } from '@/domain/types';
import type { PersistedSessionRow } from '@/persistence/types';

export const EXPORT_SCHEMA_ID = 'ballast-export-v1';

export interface ExportMeta {
  exportedAtIso: string;
  appVersion: string;
  selectedGymProfileId: string;
  unitPreference: UnitPreference;
}

export interface ExportPayload extends ExportMeta {
  schema: typeof EXPORT_SCHEMA_ID;
  sessionCount: number;
  /** Oldest → newest, loads in kg. */
  sessions: PersistedSessionRow[];
}

export function buildExportPayload(
  rows: readonly PersistedSessionRow[],
  meta: ExportMeta,
): ExportPayload {
  return {
    schema: EXPORT_SCHEMA_ID,
    ...meta,
    sessionCount: rows.length,
    sessions: [...rows],
  };
}

/** ballast-export-2026-07-19.json — date-stamped so exports don't clobber. */
export function exportFileName(exportedAtIso: string): string {
  return `ballast-export-${exportedAtIso.slice(0, 10)}.json`;
}
