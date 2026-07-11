// Single app store (CLAUDE.md §4). In-memory for now — SQLite persistence is
// the next infrastructure step; until then state resets on app restart.
// KNOWN GAP, not a design decision: PRD requires last-used profile and
// history to survive restarts.

import { create } from 'zustand';

import { PROGRESSION_BY_CLASS, SETS_PER_EXERCISE_DEFAULT } from '@/config/progressionConfig';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { getExerciseById } from '@/data/exerciseCatalog';
import {
  prescribeNextSession,
  seedPlan,
  worstFeedback,
  type ExerciseSessionResult,
} from '@/engine/progression';
import { seedLoadKgForExercise } from '@/engine/seeding';
import type { GymProfile, SetFeedback } from '@/domain/types';

/** One exercise mid-workout: the live prescription plus set-by-set feedback. */
export interface ActiveExercise {
  exerciseId: string;
  loadKg: number;
  targetReps: number;
  /** Why the engine chose this — always shown, never hidden (Exposed Mechanism). */
  rationale: string;
  setFeedbacks: SetFeedback[];
  totalSets: number;
}

interface AppState {
  /** Manual selection is primary (PRD D6); defaults to first profile until persistence lands. */
  selectedGymProfileId: string;
  /** Per-exercise session history, most recent last — the engine's only input. */
  sessionHistoryByExercise: Record<string, ExerciseSessionResult[]>;
  activeExercise: ActiveExercise | null;

  selectGymProfile: (profileId: string) => void;
  /** Prescribe from history, or seed on first encounter (PRD D2). */
  startExercise: (exerciseId: string) => void;
  /** Stepper adjustments — the only mid-workout numeric input (Sweaty Finger). */
  adjustLoad: (deltaKg: number) => void;
  adjustReps: (delta: number) => void;
  /**
   * One Post-Set Matrix tap. On the final set, collapses the session
   * (worst set governs) into history and clears the active exercise.
   */
  completeSet: (feedback: SetFeedback) => void;
  abandonExercise: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedGymProfileId: DEFAULT_GYM_PROFILES[0]!.id,
  sessionHistoryByExercise: {},
  activeExercise: null,

  selectGymProfile: (profileId) => set({ selectedGymProfileId: profileId }),

  startExercise: (exerciseId) => {
    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      // A stale route param, not a user error — refuse loudly in dev.
      console.error(`startExercise: unknown exercise id "${exerciseId}"`);
      return;
    }
    const history = get().sessionHistoryByExercise[exerciseId] ?? [];
    const plan =
      history.length > 0
        ? prescribeNextSession(exercise.exerciseClass, history)
        : seedPlan(exercise.exerciseClass, seedLoadKgForExercise(exercise));
    set({
      activeExercise: {
        exerciseId,
        loadKg: plan.loadKg,
        targetReps: plan.targetReps,
        rationale: plan.rationale,
        setFeedbacks: [],
        totalSets: SETS_PER_EXERCISE_DEFAULT,
      },
    });
  },

  adjustLoad: (deltaKg) =>
    set((state) => {
      if (!state.activeExercise) return state;
      const loadKg = Math.max(0, round2(state.activeExercise.loadKg + deltaKg));
      return { activeExercise: { ...state.activeExercise, loadKg } };
    }),

  adjustReps: (delta) =>
    set((state) => {
      if (!state.activeExercise) return state;
      const targetReps = Math.max(1, state.activeExercise.targetReps + delta);
      return { activeExercise: { ...state.activeExercise, targetReps } };
    }),

  completeSet: (feedback) => {
    const active = get().activeExercise;
    if (!active) {
      console.error('completeSet: no active exercise');
      return;
    }
    const setFeedbacks = [...active.setFeedbacks, feedback];

    if (setFeedbacks.length < active.totalSets) {
      set({ activeExercise: { ...active, setFeedbacks } });
      return;
    }

    // Final set: fold the session into history — this is the engine's input
    // for next time, closing the auto-regulation loop.
    const result: ExerciseSessionResult = {
      loadKg: active.loadKg,
      repsAchieved: active.targetReps,
      feedback: worstFeedback(setFeedbacks),
    };
    set((state) => ({
      activeExercise: null,
      sessionHistoryByExercise: {
        ...state.sessionHistoryByExercise,
        [active.exerciseId]: [
          ...(state.sessionHistoryByExercise[active.exerciseId] ?? []),
          result,
        ],
      },
    }));
  },

  abandonExercise: () => set({ activeExercise: null }),
}));

/** Resolve the active profile; falls back to the first default if the stored
 *  id goes stale (e.g. a deleted custom profile) rather than crashing Home. */
export function getProfileById(profileId: string): GymProfile {
  return (
    DEFAULT_GYM_PROFILES.find((profile) => profile.id === profileId) ?? DEFAULT_GYM_PROFILES[0]!
  );
}

/** Stepper step size follows the exercise class increment (double progression). */
export function loadStepKgForExercise(exerciseId: string): number {
  const exercise = getExerciseById(exerciseId);
  const exerciseClass = exercise?.exerciseClass ?? 'compound';
  return PROGRESSION_BY_CLASS[exerciseClass].incrementKg;
}

/** Kill 0.1+0.2 artifacts before they reach the display or history. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
