# DATA.md — populating the exercise database

The app's training content lives in two hand-editable JSON files. Edit them,
restart the app (or let Metro hot-reload), and the changes are live. Every
entry is validated at startup — a bad entry stops the app with an error naming
the exact file, index, and field, so mistakes can't silently poison fatigue
accounting.

| File | What it holds |
|------|---------------|
| `src/data/exercises.json` | The exercise catalog (38 starter entries included as examples — replace or extend freely) |
| `src/data/gymProfiles.json` | Equipment contexts (Commercial / Home / Hotel to start) |

After editing, run `npm run typecheck && npm test` — the catalog integrity
tests (unique ids, taxonomy rules) run against your data.

---

## 1. Exercise entry format

```json
{
  "id": "barbell-bench-press",
  "name": "Barbell Bench Press",
  "exerciseClass": "compound",
  "equipment": ["barbell", "bench"],
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["triceps", "shoulders"],
  "tertiaryMuscles": ["core"]
}
```

| Field | Rules |
|-------|-------|
| `id` | kebab-case (`a-z`, `0-9`, hyphens), unique across the file. **Never change an id after real training data exists** — workout history is keyed on it. |
| `name` | Display name, shown uppercase on the workout screen. |
| `exerciseClass` | `"compound"` or `"isolation"` — see §3, this drives progression behavior. |
| `equipment` | **Every** tag needed to perform the movement, including support gear (`bench`, `rack`, `pullupBar`). An exercise only appears when the active gym profile covers *all* of its tags. |
| `primaryMuscles` | At least one. The prime movers. |
| `secondaryMuscles` | Required field (may be `[]`). Meaningful assisting muscles — these count in fatigue accounting. |
| `tertiaryMuscles` | Optional — omit the field entirely unless the activation genuinely matters for fatigue accounting. Rule of thumb: if frying this muscle here should block programming its isolation work the same day, it belongs in *secondary*, not tertiary (e.g. triceps under heavy pressing). If it barely matters, leave it out. |

A muscle may appear in only **one** role per exercise.

## 2. Allowed values

**Muscle groups** (`primaryMuscles` / `secondaryMuscles` / `tertiaryMuscles`):

```
chest  back  shoulders  biceps  triceps  forearms
quads  hamstrings  glutes  calves  core
```

**Equipment tags** (`equipment`, and gym profile `equipment`):

| Tag | Meaning |
|-----|---------|
| `barbell` | Bar + plates |
| `dumbbell` | Loads are **per hand** |
| `kettlebell` | |
| `machine` | Pin/plate-loaded stations |
| `cable` | Cable stack (pulldowns, pushdowns, flies) |
| `bodyweight` | No external load; every gym profile must include it |
| `bands` | Resistance bands |
| `bench` | Support gear — flat/adjustable bench |
| `rack` | Support gear — squat rack / power rack |
| `pullupBar` | Support gear — somewhere to hang |

The lists live in [`src/domain/types.ts`](../src/domain/types.ts)
(`MUSCLE_GROUPS`, `EQUIPMENT_TAGS`). Adding a new tag there automatically
makes it valid in the JSON and available to profiles; also add its seed load
(§4).

## 3. What `exerciseClass` controls

Class selects the double-progression window in
[`src/config/progressionConfig.ts`](../src/config/progressionConfig.ts) —
tune there, not per exercise (v1):

| | rep window | load increment | default rest |
|---|---|---|---|
| `compound` | 6–10 | +2.5 kg | 180 s |
| `isolation` | 10–15 | +1.25 kg | 90 s |

The increment is also the stepper step size on the workout screen.

## 4. First-session seed loads

An exercise with no history seeds its starting load from its equipment
(`SEED_LOAD_KG_BY_EQUIPMENT` in progressionConfig): first matching tag in
priority order `barbell → dumbbell → kettlebell → machine → cable → bands →
bodyweight` decides. Current seeds: barbell 20 (empty bar), dumbbell 8 (per
hand), kettlebell 12, machine 20, cable 15, bands/bodyweight 0.

These are deliberately rough (PRD D2) — the user corrects with steppers on
set one and the feedback loop takes it from there. Don't chase precision here.

## 5. Gym profile format

```json
{ "id": "hotel", "name": "Hotel Gym", "equipment": ["dumbbell", "machine", "cable", "bodyweight", "bench"] }
```

- `equipment` must include `"bodyweight"` (availability is a plain
  subset check; every gym "has" bodyweight).
- The **first profile in the file** is the default on first launch; after
  that, last-used wins (persisted).

## 6. On-device database (informational — you don't edit this)

Workout results persist in SQLite on device (`ballast.db` in the app
sandbox, via `expo-sqlite`):

```sql
settings           (key TEXT PK, value TEXT)             -- e.g. selectedGymProfileId
exercise_sessions  (id INTEGER PK AUTOINCREMENT,
                    exercise_id TEXT,                    -- FK by convention → exercises.json id
                    load_kg REAL,
                    reps_achieved INTEGER,
                    feedback TEXT CHECK IN ('easy','justRight','grind'),
                    completed_at_iso TEXT)
```

`exercise_id` is why catalog ids must stay stable. The web dev preview uses a
localStorage stand-in (`ballast-state-v1`) — dev convenience only; the
shipped app path is SQLite.

## 7. Out of scope for these files

Programs, workout templates, and weekly volume targets are **not** data-file
content — they belong to the mesocycle/program layer (PRD D3), which is
engine + state, not catalog. Don't try to encode "push day" here.
