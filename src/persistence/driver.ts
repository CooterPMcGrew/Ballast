// Native persistence driver — SQLite via expo-sqlite (CLAUDE.md §4: workout
// history is relational and will be queried by muscle group across time).
// This is the production path for the shipped app; driver.web.ts only covers
// the dev preview.

import * as SQLite from 'expo-sqlite';

import type { ExerciseSessionResult } from '@/engine/progression';
import type { SetFeedback } from '@/domain/types';
import type { PersistedSessionRow, PersistedState, PersistenceDriver } from '@/persistence/types';

const DB_NAME = 'ballast.db';

interface SessionRow {
  exercise_id: string;
  load_kg: number;
  reps_achieved: number;
  feedback: string;
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

      const profileRow = await database.getFirstAsync<{ value: string }>(
        `SELECT value FROM settings WHERE key = 'selectedGymProfileId'`,
      );

      const rows = await database.getAllAsync<SessionRow>(
        `SELECT exercise_id, load_kg, reps_achieved, feedback
         FROM exercise_sessions ORDER BY id ASC`,
      );

      const sessionHistoryByExercise: Record<string, ExerciseSessionResult[]> = {};
      for (const row of rows) {
        const result: ExerciseSessionResult = {
          loadKg: row.load_kg,
          repsAchieved: row.reps_achieved,
          // CHECK constraint guarantees membership; cast is safe.
          feedback: row.feedback as SetFeedback,
        };
        (sessionHistoryByExercise[row.exercise_id] ??= []).push(result);
      }

      return {
        selectedGymProfileId: profileRow?.value ?? null,
        sessionHistoryByExercise,
      };
    },

    async saveSelectedProfile(profileId: string) {
      await requireDb().runAsync(
        `INSERT INTO settings (key, value) VALUES ('selectedGymProfileId', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        profileId,
      );
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
  };
}
