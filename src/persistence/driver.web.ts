// WORKAROUND — web dev-preview driver only. Solves: persistence parity while
// developing in the browser. Does NOT solve: production storage (the shipped
// app is native and uses driver.ts/SQLite) or relational queries. Root-cause
// alternative if web ever becomes a real target: expo-sqlite's wasm web
// support. Until then this stays a flat JSON blob in localStorage.

import type { CustomGymState, UnitPreference } from '@/domain/types';
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

export function createDriver(): PersistenceDriver {
  return {
    async init() {
      // localStorage needs no schema.
    },

    async loadState(): Promise<PersistedState> {
      const blob = readBlob();
      const sessionHistoryByExercise: Record<string, TimestampedSessionResult[]> = {};
      for (const row of blob.sessions) {
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

    async appendSession(row: PersistedSessionRow) {
      const blob = readBlob();
      blob.sessions.push(row);
      writeBlob(blob);
    },

    async loadAllSessionRows(): Promise<PersistedSessionRow[]> {
      return readBlob().sessions;
    },
  };
}
