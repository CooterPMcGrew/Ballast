// WORKAROUND — web dev-preview driver only. Solves: persistence parity while
// developing in the browser. Does NOT solve: production storage (the shipped
// app is native and uses driver.ts/SQLite) or relational queries. Root-cause
// alternative if web ever becomes a real target: expo-sqlite's wasm web
// support. Until then this stays a flat JSON blob in localStorage.

import type { ExerciseSessionResult } from '@/engine/progression';
import type { PersistedSessionRow, PersistedState, PersistenceDriver } from '@/persistence/types';

const STORAGE_KEY = 'ballast-state-v1';

interface StoredBlob {
  selectedGymProfileId: string | null;
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
      const sessionHistoryByExercise: Record<string, ExerciseSessionResult[]> = {};
      for (const row of blob.sessions) {
        const { exerciseId, loadKg, repsAchieved, feedback } = row;
        (sessionHistoryByExercise[exerciseId] ??= []).push({ loadKg, repsAchieved, feedback });
      }
      return { selectedGymProfileId: blob.selectedGymProfileId, sessionHistoryByExercise };
    },

    async saveSelectedProfile(profileId: string) {
      const blob = readBlob();
      blob.selectedGymProfileId = profileId;
      writeBlob(blob);
    },

    async appendSession(row: PersistedSessionRow) {
      const blob = readBlob();
      blob.sessions.push(row);
      writeBlob(blob);
    },
  };
}
