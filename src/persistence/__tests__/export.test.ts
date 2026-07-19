import { buildExportPayload, EXPORT_SCHEMA_ID, exportFileName } from '@/persistence/export';
import type { PersistedSessionRow } from '@/persistence/types';

const ROWS: PersistedSessionRow[] = [
  {
    exerciseId: 'overhead-press',
    loadKg: 40,
    repsAchieved: 8,
    feedback: 'justRight',
    completedAtIso: '2026-07-19T10:00:00.000Z',
  },
];

describe('buildExportPayload', () => {
  it('wraps full-fidelity rows with a schema id and metadata', () => {
    const payload = buildExportPayload(ROWS, {
      exportedAtIso: '2026-07-19T12:00:00.000Z',
      appVersion: '0.1.0',
      selectedGymProfileId: 'commercial',
      unitPreference: 'lb',
    });
    expect(payload.schema).toBe(EXPORT_SCHEMA_ID);
    expect(payload.sessionCount).toBe(1);
    // Loads export in kg regardless of display preference — data, not display.
    expect(payload.sessions[0]?.loadKg).toBe(40);
    expect(payload.sessions[0]?.completedAtIso).toBe('2026-07-19T10:00:00.000Z');
  });
});

describe('exportFileName', () => {
  it('date-stamps from the export timestamp', () => {
    expect(exportFileName('2026-07-19T12:34:56.000Z')).toBe('ballast-export-2026-07-19.json');
  });
});
