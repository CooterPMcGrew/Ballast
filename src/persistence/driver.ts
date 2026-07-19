// Native persistence driver — SQLite via expo-sqlite (CLAUDE.md §4: workout
// history is relational and will be queried by muscle group across time).
// This is the production path for the shipped app; driver.web.ts only covers
// the dev preview.

import * as SQLite from 'expo-sqlite';

import {
  EQUIPMENT_TAGS,
  UNIT_PREFERENCES,
  type CustomGymState,
  type EquipmentTag,
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

    async loadState(): Promise<PersistedState> {
      const database = requireDb();

      const settingRows = await database.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings`,
      );
      const settings = new Map(settingRows.map((row) => [row.key, row.value]));

      const rows = await database.getAllAsync<SessionRow>(
        `SELECT exercise_id, load_kg, reps_achieved, feedback, completed_at_iso
         FROM exercise_sessions ORDER BY id ASC`,
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

    async loadAllSessionRows(): Promise<PersistedSessionRow[]> {
      const rows = await requireDb().getAllAsync<SessionRow>(
        `SELECT exercise_id, load_kg, reps_achieved, feedback, completed_at_iso
         FROM exercise_sessions ORDER BY id ASC`,
      );
      return rows.map((row) => ({
        exerciseId: row.exercise_id,
        loadKg: row.load_kg,
        repsAchieved: row.reps_achieved,
        feedback: row.feedback as SetFeedback,
        completedAtIso: row.completed_at_iso,
      }));
    },

    async clearAllSessions() {
      await requireDb().runAsync(`DELETE FROM exercise_sessions`);
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
