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
}

/** Equipment context (PRD §1). The selected profile filters the exercise DB. */
export interface GymProfile {
  id: string;
  name: string;
  equipment: EquipmentTag[];
}

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
