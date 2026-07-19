// Persistence contract. The store is the only consumer; drivers are chosen
// per platform by Metro file resolution (driver.ts native, driver.web.ts web).

import type { CustomGymState, UnitPreference } from '@/domain/types';
import type { ExerciseSessionResult } from '@/engine/progression';

export interface PersistedSessionRow extends ExerciseSessionResult {
  exerciseId: string;
  completedAtIso: string;
}

export interface PersistedState {
  /** null = nothing stored yet (first launch). */
  selectedGymProfileId: string | null;
  unitPreference: UnitPreference | null;
  customGym: CustomGymState | null;
  /** Per exercise, oldest → newest — the order the engine expects. */
  sessionHistoryByExercise: Record<string, ExerciseSessionResult[]>;
}

export interface PersistenceDriver {
  /** Idempotent; creates schema on first run. */
  init(): Promise<void>;
  loadState(): Promise<PersistedState>;
  saveSelectedProfile(profileId: string): Promise<void>;
  saveUnitPreference(unit: UnitPreference): Promise<void>;
  saveCustomGym(customGym: CustomGymState): Promise<void>;
  appendSession(row: PersistedSessionRow): Promise<void>;
  /** Full-fidelity history (timestamps included) — the export path. */
  loadAllSessionRows(): Promise<PersistedSessionRow[]>;
}
