// Single app store (CLAUDE.md §4). In-memory for now — SQLite persistence is
// the next infrastructure step; until then state resets on app restart.
// KNOWN GAP, not a design decision: PRD requires last-used profile to survive
// restarts.

import { create } from 'zustand';

import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import type { ExerciseSessionResult } from '@/engine/progression';
import type { GymProfile } from '@/domain/types';

interface AppState {
  /** Manual selection is primary (PRD D6); defaults to first profile until persistence lands. */
  selectedGymProfileId: string;
  /** Per-exercise session history, most recent last — the engine's only input. */
  sessionHistoryByExercise: Record<string, ExerciseSessionResult[]>;

  selectGymProfile: (profileId: string) => void;
  recordExerciseSession: (exerciseId: string, result: ExerciseSessionResult) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedGymProfileId: DEFAULT_GYM_PROFILES[0]!.id,
  sessionHistoryByExercise: {},

  selectGymProfile: (profileId) => set({ selectedGymProfileId: profileId }),

  recordExerciseSession: (exerciseId, result) =>
    set((state) => ({
      sessionHistoryByExercise: {
        ...state.sessionHistoryByExercise,
        [exerciseId]: [...(state.sessionHistoryByExercise[exerciseId] ?? []), result],
      },
    })),
}));

/** Resolve the active profile; falls back to the first default if the stored
 *  id goes stale (e.g. a deleted custom profile) rather than crashing Home. */
export function getProfileById(profileId: string): GymProfile {
  return (
    DEFAULT_GYM_PROFILES.find((profile) => profile.id === profileId) ?? DEFAULT_GYM_PROFILES[0]!
  );
}
