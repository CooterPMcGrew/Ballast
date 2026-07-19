// Core domain vocabulary. Types only — no logic. The progression engine,
// recommender, and store all speak in these terms.

// Runtime arrays are the single source of truth; the union types derive from
// them. Keeps JSON catalog validation and future UI pickers enumerable
// without restating the lists.

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/**
 * Components subdivide a group only where programming actually differs
 * (CLAUDE.md §6.5 — taxonomy must earn its keep in fatigue accounting).
 * Shoulders/chest/back train regionally (a press leaves side/rear delts
 * unworked — the whole point of the session recommender); the rest stay
 * single-component until a real programming need splits them.
 */
export const MUSCLE_COMPONENTS_BY_GROUP = {
  chest: ['upperChest', 'midChest', 'lowerChest'],
  back: ['lats', 'upperBack', 'lowerBack'],
  shoulders: ['frontDelt', 'sideDelt', 'rearDelt'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  core: ['core'],
} as const satisfies Record<MuscleGroup, readonly string[]>;

export type MuscleComponent = (typeof MUSCLE_COMPONENTS_BY_GROUP)[MuscleGroup][number];

export const MUSCLE_COMPONENTS: readonly MuscleComponent[] = Object.values(
  MUSCLE_COMPONENTS_BY_GROUP,
).flat();

/** Reverse lookup, built once at module load. */
export const GROUP_BY_COMPONENT: Readonly<Record<MuscleComponent, MuscleGroup>> =
  Object.fromEntries(
    MUSCLE_GROUPS.flatMap((group) =>
      MUSCLE_COMPONENTS_BY_GROUP[group].map((component) => [component, group]),
    ),
  ) as Record<MuscleComponent, MuscleGroup>;

/** Human labels for UI + rationale strings ("sideDelt" reads badly mid-set). */
export const COMPONENT_LABELS: Readonly<Record<MuscleComponent, string>> = {
  upperChest: 'upper chest',
  midChest: 'mid chest',
  lowerChest: 'lower chest',
  lats: 'lats',
  upperBack: 'upper back',
  lowerBack: 'lower back',
  frontDelt: 'front delt',
  sideDelt: 'side delt',
  rearDelt: 'rear delt',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  core: 'core',
};

export const EQUIPMENT_TAGS = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'bands',
  'bench',
  'rack',
  'pullupBar',
] as const;
export type EquipmentTag = (typeof EQUIPMENT_TAGS)[number];

/**
 * Determines the double-progression window and increment size
 * (see progressionConfig.PROGRESSION_BY_CLASS, PRD D1).
 */
export const EXERCISE_CLASSES = ['compound', 'isolation'] as const;
export type ExerciseClass = (typeof EXERCISE_CLASSES)[number];

/**
 * Taxonomy (PRD §5): primary + secondary required; tertiary only where it
 * earns its keep in fatigue accounting (CLAUDE.md §6.5) — e.g. triceps under
 * heavy pressing, which must block same-day triceps isolation.
 */
export interface Exercise {
  id: string;
  name: string;
  exerciseClass: ExerciseClass;
  /** Every tag required to perform the movement; gym profile must cover all. */
  equipment: EquipmentTag[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  tertiaryMuscles?: MuscleGroup[];
  /**
   * Activation share per muscle component, 0–1, summing to ≈1. Seeds, not
   * truth (CLAUDE.md §6.2) — rough authoring estimates the recommender ranks
   * by; per-lift EMG precision is not claimed. Optional: when absent, shares
   * are derived from the role lists (see contributionsForExercise).
   */
  muscleContributions?: Partial<Record<MuscleComponent, number>>;
  /**
   * Per-exercise growth rate. Overrides any subset of the class default
   * window (PROGRESSION_BY_CLASS) — e.g. a lift that only tolerates 1 kg
   * jumps, or a stubborn movement given a wider rep range.
   */
  progressionOverride?: ProgressionOverride;
}

/** Partial override of a ProgressionWindow; unset fields fall back to class defaults. */
export interface ProgressionOverride {
  repRangeLow?: number;
  repRangeHigh?: number;
  incrementKg?: number;
}

/** Equipment context (PRD §1). The selected profile filters the exercise DB. */
export interface GymProfile {
  id: string;
  name: string;
  equipment: EquipmentTag[];
}

/** Reserved id for the user-built profile from Settings ("different gym"). */
export const CUSTOM_GYM_PROFILE_ID = 'custom';

/**
 * The user's own gym described as an equipment checklist. `enabled` off =
 * the stock profiles behave exactly as before ("always default to the
 * normal setup").
 */
export interface CustomGymState {
  enabled: boolean;
  equipment: EquipmentTag[];
}

/**
 * Display units. Loads are stored and progressed in kg everywhere; the
 * preference converts at the display boundary only (lb-native plate math is
 * a later, deliberate step — see domain/units.ts).
 */
export const UNIT_PREFERENCES = ['kg', 'lb'] as const;
export type UnitPreference = (typeof UNIT_PREFERENCES)[number];

/**
 * The sole per-set input to the progression engine (PRD §2, D5): three states,
 * one tap. Resolution deliberately traded for reliability.
 */
export type SetFeedback = 'easy' | 'justRight' | 'grind';

/**
 * What the engine tells the user to do next — including WHY. Exposed
 * Mechanism (CLAUDE.md §3): the algorithm always shows its work; `rationale`
 * is required, not optional metadata.
 */
export interface SetPrescription {
  exerciseId: string;
  loadKg: number;
  targetReps: number;
  /** Human-readable reasoning, e.g. "+2.5 kg — last session felt easy". */
  rationale: string;
}

export interface CompletedSet {
  prescription: SetPrescription;
  /** May differ from prescription if the user adjusted via steppers. */
  actualLoadKg: number;
  actualReps: number;
  feedback: SetFeedback;
  completedAtIso: string;
}

export interface WorkoutSession {
  id: string;
  gymProfileId: string;
  startedAtIso: string;
  sets: CompletedSet[];
}

export type TrainingGoal = 'strength' | 'hypertrophy' | 'generalFitness';

/**
 * PRD D3 — highest-priority architectural note: the training goal lives in
 * state so day-to-day auto-regulation operates INSIDE this structure and
 * cannot drift the program away from what the user is training for.
 */
export interface ProgramState {
  goal: TrainingGoal;
  /** Planned working sets per muscle per week — the volume arc the recommender serves, never overrides. */
  weeklyTargetSetsByMuscle: Partial<Record<MuscleGroup, number>>;
  /** 1-based week within the current mesocycle. */
  mesocycleWeek: number;
}

/** Injury blacklist entry (PRD §3): recommender avoids the area until expiry. */
export interface InjuryFlag {
  muscle: MuscleGroup;
  untilIso: string;
}
