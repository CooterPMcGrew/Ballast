// WORKAROUND — web dev-preview driver only. Solves: persistence parity while
// developing in the browser. Does NOT solve: production storage (the shipped
// app is native and uses driver.ts/SQLite) or relational queries. Root-cause
// alternative if web ever becomes a real target: expo-sqlite's wasm web
// support. Until then this stays a flat JSON blob in localStorage.

import type { CustomGymState, Exercise, UnitPreference } from '@/domain/types';
import type {
  PersistedSessionRow,
  PersistedState,
  PersistenceDriver,
  TimestampedSessionResult,
} from '@/persistence/types';

const STORAGE_KEY = 'ballast-state-v1';

interface StoredBlob {
  selectedGymProfileId: string | null;
  unitPreference?: UnitPreference | null;
  customGym?: CustomGymState | null;
  customExercises?: Exercise[] | null;
  sessions: PersistedSessionRow[];
}

function readBlob(): StoredBlob {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { selectedGymProfileId: null, sessions: [] };
  }
  try {
    return JSON.parse(raw) as StoredBlob;
  } catch (error) {
    // Corrupt blob: report and start fresh rather than wedging the dev app.
    console.error('web persistence: corrupt blob, resetting', error);
    return { selectedGymProfileId: null, sessions: [] };
  }
}

function writeBlob(blob: StoredBlob): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

/**
 * Oldest → newest by wall clock. Sort is stable, so rows sharing an instant
 * keep insert order. Back-dated rows (past-workout log) must not land at the
 * tail — the engine reads the last entry as the most recent session.
 */
function byCompletedAt(rows: readonly PersistedSessionRow[]): PersistedSessionRow[] {
  return [...rows].sort((a, b) => Date.parse(a.completedAtIso) - Date.parse(b.completedAtIso));
}

export function createDriver(): PersistenceDriver {
  return {
    async init() {
      // localStorage needs no schema.
    },

    async loadState(): Promise<PersistedState> {
      const blob = readBlob();
      const sessionHistoryByExercise: Record<string, TimestampedSessionResult[]> = {};
      for (const row of byCompletedAt(blob.sessions)) {
        const { exerciseId, loadKg, repsAchieved, feedback, completedAtIso } = row;
        (sessionHistoryByExercise[exerciseId] ??= []).push({
          loadKg,
          repsAchieved,
          feedback,
          completedAtIso,
        });
      }
      return {
        selectedGymProfileId: blob.selectedGymProfileId,
        unitPreference: blob.unitPreference ?? null,
        customGym: blob.customGym ?? null,
        customExercises: blob.customExercises ?? null,
        sessionHistoryByExercise,
      };
    },

    async saveSelectedProfile(profileId: string) {
      const blob = readBlob();
      blob.selectedGymProfileId = profileId;
      writeBlob(blob);
    },

    async saveUnitPreference(unit: UnitPreference) {
      const blob = readBlob();
      blob.unitPreference = unit;
      writeBlob(blob);
    },

    async saveCustomGym(customGym: CustomGymState) {
      const blob = readBlob();
      blob.customGym = customGym;
      writeBlob(blob);
    },

    async saveCustomExercises(customExercises: Exercise[]) {
      const blob = readBlob();
      blob.customExercises = customExercises;
      writeBlob(blob);
    },

    async appendSession(row: PersistedSessionRow) {
      const blob = readBlob();
      blob.sessions.push(row);
      writeBlob(blob);
    },

    async deleteSession(row: PersistedSessionRow) {
      const blob = readBlob();
      const index = blob.sessions.findIndex(
        (stored) =>
          stored.exerciseId === row.exerciseId &&
          stored.loadKg === row.loadKg &&
          stored.repsAchieved === row.repsAchieved &&
          stored.feedback === row.feedback &&
          stored.completedAtIso === row.completedAtIso,
      );
      if (index === -1) return; // already gone; nothing to repair
      blob.sessions.splice(index, 1);
      writeBlob(blob);
    },

    async loadAllSessionRows(): Promise<PersistedSessionRow[]> {
      return byCompletedAt(readBlob().sessions);
    },
  };
}
