// Persistence contract. The store is the only consumer; drivers are chosen
// per platform by Metro file resolution (driver.ts native, driver.web.ts web).

import type { CustomGymState, UnitPreference } from '@/domain/types';
import type { ExerciseSessionResult } from '@/engine/progression';

/**
 * A session result with its wall-clock moment. The engine only reads the
 * ExerciseSessionResult part; the timestamp feeds the recency figure and
 * history views.
 */
export interface TimestampedSessionResult extends ExerciseSessionResult {
  completedAtIso: string;
}

export interface PersistedSessionRow extends TimestampedSessionResult {
  exerciseId: string;
}

export interface PersistedState {
  /** null = nothing stored yet (first launch). */
  selectedGymProfileId: string | null;
  unitPreference: UnitPreference | null;
  customGym: CustomGymState | null;
  /** Per exercise, oldest → newest — the order the engine expects. */
  sessionHistoryByExercise: Record<string, TimestampedSessionResult[]>;
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
