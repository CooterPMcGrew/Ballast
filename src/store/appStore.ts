// Single app store (CLAUDE.md §4). Hydrates from the platform persistence
// driver at startup (SQLite on device, localStorage shim on dev web) and
// writes through on every durable mutation. Persistence failures degrade to
// in-memory operation — loudly, never silently.

import { create } from 'zustand';

import {
  PROGRESSION_BY_CLASS,
  progressionWindowForExercise,
  SETS_PER_EXERCISE_DEFAULT,
  SETS_PER_EXERCISE_MAX,
} from '@/config/progressionConfig';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { buildDemoHistory } from '@/data/demoHistory';
import { getExerciseById } from '@/data/exerciseCatalog';
import { prescribeNextSession, seedPlan, worstFeedback } from '@/engine/progression';
import { estimateSessionEnergy, type EnergyEstimate } from '@/engine/energy';
import { seedLoadKgForExercise } from '@/engine/seeding';
import { persistence } from '@/persistence';
import type { TimestampedSessionResult } from '@/persistence/types';
import {
  CUSTOM_GYM_PROFILE_ID,
  type CustomGymState,
  type GymProfile,
  type MuscleGroup,
  type SetFeedback,
  type UnitPreference,
} from '@/domain/types';

/** One exercise mid-workout: the live prescription plus set-by-set feedback. */
export interface ActiveExercise {
  exerciseId: string;
  loadKg: number;
  targetReps: number;
  /** Why the engine chose this — always shown, never hidden (Exposed Mechanism). */
  rationale: string;
  setFeedbacks: SetFeedback[];
  totalSets: number;
  /**
   * Superset leg: 0 = first of the pair (no rest after its set), 1 = second
   * (rest fires after it, covering the pair). Absent = not supersetting.
   */
  supersetOrder?: 0 | 1;
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
/** One completed set, as performed — the session's chronological record. */
export interface SetLogEntry {
  exerciseId: string;
  loadKg: number;
  reps: number;
  feedback: SetFeedback;
  completedAtIso: string;
}

export interface ActiveSession {
  /** Current focus — one muscle (bro split) or a preset's set (PPL etc.). */
  muscleGroups: MuscleGroup[];
  completedExerciseIds: string[];
  startedAtIso: string;
  setsCompleted: number;
  /** Every set this session, in order — the "stacking blocks" log. */
  setLog: SetLogEntry[];
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
  /** Per-exercise history, most recent last, every lift timestamped. The
   *  engine reads the result fields; the recency figure reads the clock. */
  sessionHistoryByExercise: Record<string, TimestampedSessionResult[]>;
  activeExercise: ActiveExercise | null;
  /** The other half of a superset pair, waiting while its partner works. */
  pausedExercise: ActiveExercise | null;
  /** "The next two exercises I pick pair up" (session-page toggle). */
  supersetArmed: boolean;
  supersetPendingId: string | null;
  activeSession: ActiveSession | null;
  /** Set by endSession(); the summary screen reads it. Replaced each session. */
  lastSessionSummary: SessionSummary | null;
  /** Display units only — storage and progression stay kg (domain/units.ts). */
  unitPreference: UnitPreference;
  /** "Different gym": off = stock profiles exactly as shipped. */
  customGym: CustomGymState;

  /** Load persisted state; call once from the root layout. */
  hydrate: () => Promise<void>;
  selectGymProfile: (profileId: string) => void;
  setUnitPreference: (unit: UnitPreference) => void;
  /**
   * Replace the custom gym description. Enabling selects it; disabling
   * while selected falls back to the first stock profile.
   */
  setCustomGym: (customGym: CustomGymState) => void;
  /** Prototyping aid: write the demo training block into real history. */
  seedDemoHistory: () => Promise<void>;
  /** Destructive; Settings gates it behind a two-tap confirm. */
  clearHistory: () => Promise<void>;
  /**
   * Declare or switch today's focus. An already-running session keeps its
   * completed work and clock — only the recommender's target changes.
   */
  startSession: (muscleGroups: MuscleGroup[]) => void;
  /** Close the session and leave a summary in lastSessionSummary. */
  endSession: () => void;
  /** Prescribe from history, or seed on first encounter (PRD D2). */
  startExercise: (exerciseId: string) => void;
  toggleSupersetArm: () => void;
  /**
   * While armed: first pick is held pending, second begins the pair.
   * Returns what happened so the UI knows whether to navigate.
   */
  pickSupersetExercise: (exerciseId: string) => 'pending' | 'started' | 'error';
  /** Alternate the pair — caller decides when (after each completed set). */
  swapSupersetPartner: () => void;
  /** Stepper adjustments (zero-precision default path). */
  adjustLoad: (deltaKg: number) => void;
  adjustReps: (delta: number) => void;
  /** Direct entry via the big-key NumberPad — kg always, caller converts. */
  setLoadKg: (loadKg: number) => void;
  setTargetReps: (reps: number) => void;
  /** Change remaining sets mid-exercise; floor = the set being done now. */
  adjustSets: (delta: number) => void;
  /**
   * Remove the most recent completed set (phantom tap, wrong button).
   * Mid-exercise only — a folded exercise is history, not a draft.
   */
  undoLastSet: () => void;
  /**
   * One Post-Set Matrix tap. On the final set, collapses the session
   * (worst set governs) into history and clears the active exercise.
   */
  completeSet: (feedback: SetFeedback) => void;
  abandonExercise: () => void;
}

export const useAppStore = create<AppState>((set, get) => {
  /** Prescription for one exercise: from history, or seeded (PRD D2). */
  const buildActiveExercise = (
    exerciseId: string,
    supersetOrder?: 0 | 1,
  ): ActiveExercise | null => {
    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      console.error(`buildActiveExercise: unknown exercise id "${exerciseId}"`);
      return null;
    }
    const window = progressionWindowForExercise(exercise);
    const history = get().sessionHistoryByExercise[exerciseId] ?? [];
    const plan =
      history.length > 0
        ? prescribeNextSession(window, history)
        : seedPlan(window, seedLoadKgForExercise(exercise));
    return {
      exerciseId,
      loadKg: plan.loadKg,
      targetReps: plan.targetReps,
      rationale: plan.rationale,
      setFeedbacks: [],
      totalSets: SETS_PER_EXERCISE_DEFAULT,
      supersetOrder,
    };
  };

  return {
  hydrated: false,
  selectedGymProfileId: DEFAULT_GYM_PROFILES[0]!.id,
  sessionHistoryByExercise: {},
  activeExercise: null,
  pausedExercise: null,
  supersetArmed: false,
  supersetPendingId: null,
  activeSession: null,
  lastSessionSummary: null,
  unitPreference: 'kg',
  // Bodyweight-only until described — the one tag every gym has.
  customGym: { enabled: false, equipment: ['bodyweight'] },

  hydrate: async () => {
    try {
      await persistence.init();
      const persisted = await persistence.loadState();
      set({
        hydrated: true,
        selectedGymProfileId: persisted.selectedGymProfileId ?? DEFAULT_GYM_PROFILES[0]!.id,
        sessionHistoryByExercise: persisted.sessionHistoryByExercise,
        unitPreference: persisted.unitPreference ?? 'kg',
        customGym: persisted.customGym ?? { enabled: false, equipment: ['bodyweight'] },
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

  setUnitPreference: (unit) => {
    set({ unitPreference: unit });
    persistence
      .saveUnitPreference(unit)
      .catch((error) => console.error('persistence: unit save failed', error));
  },

  setCustomGym: (customGym) => {
    set({ customGym });
    persistence
      .saveCustomGym(customGym)
      .catch((error) => console.error('persistence: custom gym save failed', error));

    const { selectedGymProfileId, selectGymProfile } = get();
    if (customGym.enabled && selectedGymProfileId !== CUSTOM_GYM_PROFILE_ID) {
      selectGymProfile(CUSTOM_GYM_PROFILE_ID);
    } else if (!customGym.enabled && selectedGymProfileId === CUSTOM_GYM_PROFILE_ID) {
      selectGymProfile(DEFAULT_GYM_PROFILES[0]!.id);
    }
  },

  seedDemoHistory: async () => {
    try {
      for (const row of buildDemoHistory(Date.now())) {
        await persistence.appendSession(row);
      }
      const persisted = await persistence.loadState();
      set({ sessionHistoryByExercise: persisted.sessionHistoryByExercise });
    } catch (error) {
      console.error('seedDemoHistory failed', error);
    }
  },

  clearHistory: async () => {
    try {
      await persistence.clearAllSessions();
      set({ sessionHistoryByExercise: {} });
    } catch (error) {
      console.error('clearHistory failed', error);
    }
  },

  startSession: (muscleGroups) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, muscleGroups }
        : {
            muscleGroups,
            completedExerciseIds: [],
            startedAtIso: new Date().toISOString(),
            setsCompleted: 0,
            setLog: [],
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
      activeExercise: null,
      pausedExercise: null,
      supersetArmed: false,
      supersetPendingId: null,
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
    const built = buildActiveExercise(exerciseId);
    if (built) {
      set({ activeExercise: built, pausedExercise: null });
    }
  },

  toggleSupersetArm: () =>
    set((state) => ({ supersetArmed: !state.supersetArmed, supersetPendingId: null })),

  pickSupersetExercise: (exerciseId) => {
    const pendingId = get().supersetPendingId;
    if (!pendingId) {
      set({ supersetPendingId: exerciseId });
      return 'pending';
    }
    const first = buildActiveExercise(pendingId, 0);
    const second = buildActiveExercise(exerciseId, 1);
    if (!first || !second) {
      set({ supersetArmed: false, supersetPendingId: null });
      return 'error';
    }
    set({
      activeExercise: first,
      pausedExercise: second,
      supersetArmed: false,
      supersetPendingId: null,
    });
    return 'started';
  },

  swapSupersetPartner: () =>
    set((state) =>
      state.pausedExercise
        ? { activeExercise: state.pausedExercise, pausedExercise: state.activeExercise }
        : state,
    ),

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

  setLoadKg: (loadKg) =>
    set((state) => {
      if (!state.activeExercise || !Number.isFinite(loadKg)) return state;
      return {
        activeExercise: { ...state.activeExercise, loadKg: Math.max(0, round2(loadKg)) },
      };
    }),

  setTargetReps: (reps) =>
    set((state) => {
      if (!state.activeExercise || !Number.isFinite(reps)) return state;
      return {
        activeExercise: { ...state.activeExercise, targetReps: Math.max(1, Math.round(reps)) },
      };
    }),

  adjustSets: (delta) =>
    set((state) => {
      if (!state.activeExercise) return state;
      // Can't retire sets already done; the current set must still complete.
      const floor = state.activeExercise.setFeedbacks.length + 1;
      const totalSets = Math.min(
        SETS_PER_EXERCISE_MAX,
        Math.max(floor, state.activeExercise.totalSets + delta),
      );
      return { activeExercise: { ...state.activeExercise, totalSets } };
    }),

  completeSet: (feedback) => {
    const active = get().activeExercise;
    if (!active) {
      console.error('completeSet: no active exercise');
      return;
    }
    const setFeedbacks = [...active.setFeedbacks, feedback];
    const logEntry: SetLogEntry = {
      exerciseId: active.exerciseId,
      loadKg: active.loadKg,
      reps: active.targetReps,
      feedback,
      completedAtIso: new Date().toISOString(),
    };

    if (setFeedbacks.length < active.totalSets) {
      set((state) => ({
        activeExercise: { ...active, setFeedbacks },
        activeSession: logSet(state.activeSession, logEntry),
      }));
      return;
    }

    // Final set: fold the session into history — this is the engine's input
    // for next time, closing the auto-regulation loop.
    const result: TimestampedSessionResult = {
      loadKg: active.loadKg,
      repsAchieved: active.targetReps,
      feedback: worstFeedback(setFeedbacks),
      completedAtIso: new Date().toISOString(),
    };
    set((state) => ({
      // A folded exercise hands the screen to its superset partner, if any.
      activeExercise: state.pausedExercise,
      pausedExercise: null,
      sessionHistoryByExercise: {
        ...state.sessionHistoryByExercise,
        [active.exerciseId]: [
          ...(state.sessionHistoryByExercise[active.exerciseId] ?? []),
          result,
        ],
      },
      // Feed session coverage so the recommender re-ranks around what's done.
      activeSession: logSet(
        state.activeSession && {
          ...state.activeSession,
          completedExerciseIds: state.activeSession.completedExerciseIds.includes(
            active.exerciseId,
          )
            ? state.activeSession.completedExerciseIds
            : [...state.activeSession.completedExerciseIds, active.exerciseId],
        },
        logEntry,
      ),
    }));
    persistence
      .appendSession({ exerciseId: active.exerciseId, ...result })
      .catch((error) => console.error('persistence: session save failed', error));
  },

  undoLastSet: () =>
    set((state) => {
      const active = state.activeExercise;
      if (!active || active.setFeedbacks.length === 0) {
        return state;
      }
      // The log's last entry is necessarily this exercise's set — logging
      // only happens through completeSet on the active exercise.
      const session = state.activeSession;
      return {
        activeExercise: { ...active, setFeedbacks: active.setFeedbacks.slice(0, -1) },
        activeSession: session
          ? {
              ...session,
              setsCompleted: Math.max(0, session.setsCompleted - 1),
              setLog: session.setLog.slice(0, -1),
            }
          : null,
      };
    }),

  // Cancel abandons the CURRENT half only; a superset partner takes over.
  abandonExercise: () =>
    set((state) => ({ activeExercise: state.pausedExercise, pausedExercise: null })),
  };
});

/**
 * Resolve the active profile, including the user-built one from Settings.
 * Falls back to the first stock profile if the stored id goes stale (custom
 * gym disabled, deleted profile) rather than crashing Home.
 */
export function getProfileById(profileId: string, customGym?: CustomGymState | null): GymProfile {
  if (profileId === CUSTOM_GYM_PROFILE_ID && customGym?.enabled) {
    return {
      id: CUSTOM_GYM_PROFILE_ID,
      name: 'Custom Gym',
      // Availability is a subset check; bodyweight is guaranteed like the
      // stock profiles (catalogValidation enforces the same invariant).
      equipment: customGym.equipment.includes('bodyweight')
        ? customGym.equipment
        : [...customGym.equipment, 'bodyweight'],
    };
  }
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

/** Every Post-Set tap is one completed set, appended to the session log. */
function logSet(session: ActiveSession | null, entry: SetLogEntry): ActiveSession | null {
  return session
    ? {
        ...session,
        setsCompleted: session.setsCompleted + 1,
        setLog: [...session.setLog, entry],
      }
    : null;
}
