// Single app store (CLAUDE.md §4). Hydrates from the platform persistence
// driver at startup (SQLite on device, localStorage shim on dev web) and
// writes through on every durable mutation. Persistence failures degrade to
// in-memory operation — loudly, never silently.

import { create } from 'zustand';

import {
  PROGRESSION_BY_CLASS,
  progressionWindowForExercise,
  SETS_PER_EXERCISE_DEFAULT,
} from '@/config/progressionConfig';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { getExerciseById } from '@/data/exerciseCatalog';
import {
  prescribeNextSession,
  seedPlan,
  worstFeedback,
  type ExerciseSessionResult,
} from '@/engine/progression';
import { estimateSessionEnergy, type EnergyEstimate } from '@/engine/energy';
import { seedLoadKgForExercise } from '@/engine/seeding';
import { persistence } from '@/persistence';
import type { GymProfile, MuscleGroup, SetFeedback } from '@/domain/types';

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

/**
 * A running workout session: the current focus (target group) plus what's
 * been completed, which the recommender re-ranks against after every
 * exercise. Switching focus mid-session keeps the completed work — it's one
 * physical workout, the group is just where attention points. In-memory
 * only — the completed sets themselves persist per exercise, but
 * session-scoped coverage resets on app restart (workaround: acceptable for
 * one workout; a persisted session row is the root fix and arrives with
 * workout history views).
 */
export interface ActiveSession {
  muscleGroup: MuscleGroup;
  completedExerciseIds: string[];
  startedAtIso: string;
  setsCompleted: number;
}

/** Snapshot built by endSession() for the summary screen. In-memory only. */
export interface SessionSummary {
  exerciseNames: string[];
  setsCompleted: number;
  durationMs: number;
  energy: EnergyEstimate;
}

interface AppState {
  /** False until persisted state has been loaded (or load has failed loudly). */
  hydrated: boolean;
  /** Manual selection is primary (PRD D6); last-used restored on launch. */
  selectedGymProfileId: string;
  /** Per-exercise session history, most recent last — the engine's only input. */
  sessionHistoryByExercise: Record<string, ExerciseSessionResult[]>;
  activeExercise: ActiveExercise | null;
  activeSession: ActiveSession | null;
  /** Set by endSession(); the summary screen reads it. Replaced each session. */
  lastSessionSummary: SessionSummary | null;

  /** Load persisted state; call once from the root layout. */
  hydrate: () => Promise<void>;
  selectGymProfile: (profileId: string) => void;
  /**
   * Declare or switch today's focus. An already-running session keeps its
   * completed work and clock — only the recommender's target changes.
   */
  startSession: (muscleGroup: MuscleGroup) => void;
  /** Close the session and leave a summary in lastSessionSummary. */
  endSession: () => void;
  /** Prescribe from history, or seed on first encounter (PRD D2). */
  startExercise: (exerciseId: string) => void;
  /** Stepper adjustments — the only mid-workout numeric input (zero-precision). */
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
  hydrated: false,
  selectedGymProfileId: DEFAULT_GYM_PROFILES[0]!.id,
  sessionHistoryByExercise: {},
  activeExercise: null,
  activeSession: null,
  lastSessionSummary: null,

  hydrate: async () => {
    try {
      await persistence.init();
      const persisted = await persistence.loadState();
      set({
        hydrated: true,
        selectedGymProfileId: persisted.selectedGymProfileId ?? DEFAULT_GYM_PROFILES[0]!.id,
        sessionHistoryByExercise: persisted.sessionHistoryByExercise,
      });
    } catch (error) {
      // Degrade to in-memory defaults but keep the app usable; the failure
      // is loud in dev and the next durable write will surface it again.
      console.error('persistence: hydrate failed, running in-memory', error);
      set({ hydrated: true });
    }
  },

  selectGymProfile: (profileId) => {
    set({ selectedGymProfileId: profileId });
    persistence
      .saveSelectedProfile(profileId)
      .catch((error) => console.error('persistence: profile save failed', error));
  },

  startSession: (muscleGroup) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, muscleGroup }
        : {
            muscleGroup,
            completedExerciseIds: [],
            startedAtIso: new Date().toISOString(),
            setsCompleted: 0,
          },
    })),

  endSession: () => {
    const session = get().activeSession;
    if (!session) {
      console.error('endSession: no active session');
      return;
    }
    const durationMs = Math.max(0, Date.now() - Date.parse(session.startedAtIso));
    set({
      activeSession: null,
      lastSessionSummary: {
        exerciseNames: session.completedExerciseIds
          .map((id) => getExerciseById(id)?.name)
          .filter((name): name is string => name !== undefined),
        setsCompleted: session.setsCompleted,
        durationMs,
        energy: estimateSessionEnergy(durationMs),
      },
    });
  },

  startExercise: (exerciseId) => {
    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      // A stale route param, not a user error — refuse loudly in dev.
      console.error(`startExercise: unknown exercise id "${exerciseId}"`);
      return;
    }
    const window = progressionWindowForExercise(exercise);
    const history = get().sessionHistoryByExercise[exerciseId] ?? [];
    const plan =
      history.length > 0
        ? prescribeNextSession(window, history)
        : seedPlan(window, seedLoadKgForExercise(exercise));
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
      set((state) => ({
        activeExercise: { ...active, setFeedbacks },
        activeSession: bumpSetCount(state.activeSession),
      }));
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
      // Feed session coverage so the recommender re-ranks around what's done.
      activeSession: bumpSetCount(
        state.activeSession && {
          ...state.activeSession,
          completedExerciseIds: state.activeSession.completedExerciseIds.includes(
            active.exerciseId,
          )
            ? state.activeSession.completedExerciseIds
            : [...state.activeSession.completedExerciseIds, active.exerciseId],
        },
      ),
    }));
    persistence
      .appendSession({
        exerciseId: active.exerciseId,
        ...result,
        completedAtIso: new Date().toISOString(),
      })
      .catch((error) => console.error('persistence: session save failed', error));
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

/** Stepper step size follows the exercise's effective increment (double progression). */
export function loadStepKgForExercise(exerciseId: string): number {
  const exercise = getExerciseById(exerciseId);
  return exercise
    ? progressionWindowForExercise(exercise).incrementKg
    : PROGRESSION_BY_CLASS.compound.incrementKg;
}

/** Kill 0.1+0.2 artifacts before they reach the display or history. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Every Post-Set tap is one completed set, whatever exercise it belongs to. */
function bumpSetCount(session: ActiveSession | null): ActiveSession | null {
  return session ? { ...session, setsCompleted: session.setsCompleted + 1 } : null;
}
