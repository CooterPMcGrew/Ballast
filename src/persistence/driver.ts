// Native persistence driver — SQLite via expo-sqlite (CLAUDE.md §4: workout
// history is relational and will be queried by muscle group across time).
// This is the production path for the shipped app; driver.web.ts only covers
// the dev preview.

import * as SQLite from 'expo-sqlite';

import {
  EQUIPMENT_TAGS,
  MUSCLE_GROUPS,
  UNIT_PREFERENCES,
  type CustomGymState,
  type CustomSplit,
  type EquipmentTag,
  type Exercise,
  type MuscleGroup,
  type SetFeedback,
  type UnitPreference,
} from '@/domain/types';
import type {
  PersistedSessionRow,
  PersistedState,
  PersistenceDriver,
  TimestampedSessionResult,
} from '@/persistence/types';

const DB_NAME = 'ballast.db';

/** settings-table keys — the only strings the key column may take. */
const SETTING_PROFILE = 'selectedGymProfileId';
const SETTING_UNIT = 'unitPreference';
const SETTING_CUSTOM_GYM = 'customGymJson';
// WORKAROUND — custom exercises live as a settings JSON blob, not in the
// (still empty) exercises tables. Solves cross-driver parity in one step;
// does not solve relational queries over customs. Root fix: migrate into
// the exercises tables when they become the authoritative store (v2).
const SETTING_CUSTOM_EXERCISES = 'customExercisesJson';
// Same settings-blob workaround as customs above: a split is a name plus a
// group list, with no relational query behind it worth a table.
const SETTING_CUSTOM_SPLITS = 'customSplitsJson';

interface SessionRow {
  exercise_id: string;
  load_kg: number;
  reps_achieved: number;
  feedback: string;
  completed_at_iso: string;
}

export function createDriver(): PersistenceDriver {
  let db: SQLite.SQLiteDatabase | null = null;

  const requireDb = (): SQLite.SQLiteDatabase => {
    if (!db) throw new Error('persistence: driver used before init()');
    return db;
  };

  return {
    async init() {
      db = await SQLite.openDatabaseAsync(DB_NAME);
      // WAL keeps set-completion writes from ever blocking the UI thread's reads.
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS exercise_sessions (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_id      TEXT NOT NULL,
          load_kg          REAL NOT NULL,
          reps_achieved    INTEGER NOT NULL,
          feedback         TEXT NOT NULL CHECK (feedback IN ('easy','justRight','grind')),
          completed_at_iso TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_by_exercise
          ON exercise_sessions (exercise_id, id);

        -- Exercise catalog tables: schema only, deliberately UNPOPULATED.
        -- The live catalog ships as exercises.json for now; these become the
        -- authoritative store when user-defined exercises and per-profile
        -- metrics (login, v2) arrive. Mirrors the Exercise domain type:
        -- rep_range_low/high + increment_kg = per-exercise growth override
        -- (NULL = class default); contributions = activation share 0–1.
        CREATE TABLE IF NOT EXISTS exercises (
          id             TEXT PRIMARY KEY NOT NULL,
          name           TEXT NOT NULL,
          exercise_class TEXT NOT NULL CHECK (exercise_class IN ('compound','isolation')),
          rep_range_low  INTEGER,
          rep_range_high INTEGER,
          increment_kg   REAL
        );
        CREATE TABLE IF NOT EXISTS exercise_equipment (
          exercise_id   TEXT NOT NULL REFERENCES exercises(id),
          equipment_tag TEXT NOT NULL,
          PRIMARY KEY (exercise_id, equipment_tag)
        );
        CREATE TABLE IF NOT EXISTS exercise_muscle_contributions (
          exercise_id      TEXT NOT NULL REFERENCES exercises(id),
          muscle_component TEXT NOT NULL,
          share            REAL NOT NULL CHECK (share > 0 AND share <= 1),
          PRIMARY KEY (exercise_id, muscle_component)
        );
      `);
    },

    // Ordered by wall clock, not insert id: the past-workout log writes
    // back-dated rows, and the engine reads the tail of each exercise's
    // history as its most recent session. ISO-8601 UTC strings sort
    // lexicographically in the same order as the instants they name.
    async loadState(): Promise<PersistedState> {
      const database = requireDb();

      const settingRows = await database.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings`,
      );
      const settings = new Map(settingRows.map((row) => [row.key, row.value]));

      const rows = await database.getAllAsync<SessionRow>(
        `SELECT exercise_id, load_kg, reps_achieved, feedback, completed_at_iso
         FROM exercise_sessions ORDER BY completed_at_iso ASC, id ASC`,
      );

      const sessionHistoryByExercise: Record<string, TimestampedSessionResult[]> = {};
      for (const row of rows) {
        const result: TimestampedSessionResult = {
          loadKg: row.load_kg,
          repsAchieved: row.reps_achieved,
          // CHECK constraint guarantees membership; cast is safe.
          feedback: row.feedback as SetFeedback,
          completedAtIso: row.completed_at_iso,
        };
        (sessionHistoryByExercise[row.exercise_id] ??= []).push(result);
      }

      return {
        selectedGymProfileId: settings.get(SETTING_PROFILE) ?? null,
        unitPreference: parseUnit(settings.get(SETTING_UNIT)),
        customGym: parseCustomGym(settings.get(SETTING_CUSTOM_GYM)),
        customExercises: parseCustomExercises(settings.get(SETTING_CUSTOM_EXERCISES)),
        customSplits: parseCustomSplits(settings.get(SETTING_CUSTOM_SPLITS)),
        sessionHistoryByExercise,
      };
    },

    async saveSelectedProfile(profileId: string) {
      await upsertSetting(requireDb(), SETTING_PROFILE, profileId);
    },

    async saveUnitPreference(unit: UnitPreference) {
      await upsertSetting(requireDb(), SETTING_UNIT, unit);
    },

    async saveCustomGym(customGym: CustomGymState) {
      await upsertSetting(requireDb(), SETTING_CUSTOM_GYM, JSON.stringify(customGym));
    },

    async saveCustomExercises(customExercises) {
      await upsertSetting(
        requireDb(),
        SETTING_CUSTOM_EXERCISES,
        JSON.stringify(customExercises),
      );
    },

    async saveCustomSplits(customSplits) {
      await upsertSetting(requireDb(), SETTING_CUSTOM_SPLITS, JSON.stringify(customSplits));
    },

    async appendSession(row: PersistedSessionRow) {
      await requireDb().runAsync(
        `INSERT INTO exercise_sessions
           (exercise_id, load_kg, reps_achieved, feedback, completed_at_iso)
         VALUES (?, ?, ?, ?, ?)`,
        row.exerciseId,
        row.loadKg,
        row.repsAchieved,
        row.feedback,
        row.completedAtIso,
      );
    },

    async deleteSession(row: PersistedSessionRow) {
      // Delete by id from a single-row subquery: plain `DELETE ... LIMIT 1`
      // needs a compile flag (SQLITE_ENABLE_UPDATE_DELETE_LIMIT) that this
      // build does not carry, and an unbounded DELETE would take every
      // duplicate of a repeated lift with it.
      await requireDb().runAsync(
        `DELETE FROM exercise_sessions WHERE id = (
           SELECT id FROM exercise_sessions
           WHERE exercise_id = ? AND load_kg = ? AND reps_achieved = ?
             AND feedback = ? AND completed_at_iso = ?
           ORDER BY id DESC LIMIT 1
         )`,
        row.exerciseId,
        row.loadKg,
        row.repsAchieved,
        row.feedback,
        row.completedAtIso,
      );
    },

    async loadAllSessionRows(): Promise<PersistedSessionRow[]> {
      const rows = await requireDb().getAllAsync<SessionRow>(
        `SELECT exercise_id, load_kg, reps_achieved, feedback, completed_at_iso
         FROM exercise_sessions ORDER BY completed_at_iso ASC, id ASC`,
      );
      return rows.map((row) => ({
        exerciseId: row.exercise_id,
        loadKg: row.load_kg,
        repsAchieved: row.reps_achieved,
        feedback: row.feedback as SetFeedback,
        completedAtIso: row.completed_at_iso,
      }));
    },
  };
}

async function upsertSetting(db: SQLite.SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

function parseUnit(raw: string | undefined): UnitPreference | null {
  return raw !== undefined && UNIT_PREFERENCES.includes(raw as UnitPreference)
    ? (raw as UnitPreference)
    : null;
}

/** Corrupt or junk entries drop loudly; the app never wedges on stored data. */
function parseCustomExercises(raw: string | undefined): Exercise[] | null {
  if (raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw) as Exercise[];
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed.filter(
      (entry) =>
        typeof entry?.id === 'string' &&
        typeof entry?.name === 'string' &&
        Array.isArray(entry?.primaryMuscles),
    );
  } catch (error) {
    console.error('persistence: corrupt custom exercises, ignoring', error);
    return null;
  }
}

/**
 * Unknown muscle groups are dropped, not trusted: a stored split outlives
 * any rename of the taxonomy, and an unknown group would reach the
 * recommender as a focus that matches nothing. A split left with no groups
 * is discarded entirely.
 */
function parseCustomSplits(raw: string | undefined): CustomSplit[] | null {
  if (raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw) as CustomSplit[];
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed
      .filter((entry) => typeof entry?.id === 'string' && typeof entry?.name === 'string')
      .map((entry) => ({
        ...entry,
        muscleGroups: (entry.muscleGroups ?? []).filter((group): group is MuscleGroup =>
          MUSCLE_GROUPS.includes(group),
        ),
      }))
      .filter((entry) => entry.muscleGroups.length > 0);
  } catch (error) {
    console.error('persistence: corrupt custom splits, ignoring', error);
    return null;
  }
}

/** A corrupt stored blob resets to null (loudly) rather than wedging startup. */
function parseCustomGym(raw: string | undefined): CustomGymState | null {
  if (raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw) as CustomGymState;
    const equipment = parsed.equipment.filter((tag): tag is EquipmentTag =>
      EQUIPMENT_TAGS.includes(tag),
    );
    return { enabled: parsed.enabled === true, equipment };
  } catch (error) {
    console.error('persistence: corrupt custom gym setting, ignoring', error);
    return null;
  }
}
