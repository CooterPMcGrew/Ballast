// Persistence contract. The store is the only consumer; drivers are chosen
// per platform by Metro file resolution (driver.ts native, driver.web.ts web).

import type { CustomGymState, Exercise, UnitPreference } from '@/domain/types';
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
  /** User-defined exercises (local-only; contributions always derived). */
  customExercises: Exercise[] | null;
  /**
   * Per exercise, oldest → newest BY WALL CLOCK — the order the engine
   * expects. Not insert order: a back-dated row from the past-workout log
   * must not sit at the tail, where the engine would read it as the most
   * recent session.
   */
  sessionHistoryByExercise: Record<string, TimestampedSessionResult[]>;
}

export interface PersistenceDriver {
  /** Idempotent; creates schema on first run. */
  init(): Promise<void>;
  loadState(): Promise<PersistedState>;
  saveSelectedProfile(profileId: string): Promise<void>;
  saveUnitPreference(unit: UnitPreference): Promise<void>;
  saveCustomGym(customGym: CustomGymState): Promise<void>;
  saveCustomExercises(customExercises: Exercise[]): Promise<void>;
  /** Rows may be back-dated (past-workout log); loads sort them, not this. */
  appendSession(row: PersistedSessionRow): Promise<void>;
  /**
   * Remove exactly ONE row matching every field of `row` — the repair path
   * for a mis-entered lift, which would otherwise drive the engine's next
   * prescription forever. Rows carry no id, so identity is the field tuple;
   * when several rows match they are by definition identical, so which one
   * goes is unobservable. A no-match is a no-op, not an error.
   */
  deleteSession(row: PersistedSessionRow): Promise<void>;
  /** Full-fidelity history (timestamps included), oldest first — the export path. */
  loadAllSessionRows(): Promise<PersistedSessionRow[]>;
}
