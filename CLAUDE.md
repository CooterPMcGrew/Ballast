# CLAUDE.md — Sweaty Finger

Authoritative operating brief for this repository. Read `docs/PRD.md` for the
feature spec. This file governs *how* you build; the PRD governs *what*.

---

## 1. What this is

An auto-regulating strength-training app. Not a logbook. The app prescribes the
next set, the user reports how it went in one tap, and the app adjusts the
prescription. The user is sweaty, tired, and glancing at the screen between sets
with headphones on.

**Out of scope for v1:** voice control, social features, nutrition tracking,
Apple Watch / wearable integration. Do not build these. Do not scaffold hooks
for them.

## 2. Governing principle — "Sweaty Finger"

Zero-precision interaction. Assume the user cannot aim.

- No keyboard **anywhere** in the active-workout flow. Numeric entry is `+`/`-`
  steppers or a scroll wheel only. If you find yourself reaching for a
  `<TextInput>` inside a workout screen, stop — that is a spec violation.
- Primary actions have a **minimum 64pt touch target** (larger than the 44pt
  Apple HIG / 48dp Material floor — deliberately, because the user is tired and
  imprecise). Secondary actions ≥ 48pt.
- One-thumb reachable. Primary buttons live in the lower two-thirds of the
  screen.
- Load and rep numbers must be glance-readable — large, high-contrast, monospace.

## 3. Design system — "Exposed Mechanism"

The aesthetic is not decoration; here it earns its keep functionally, and every
choice below is justified on that basis. If a visual element does no work
(thermal analogue = readability, glare, glance-parse, semantic signaling),
cut it.

**The core product translation:** "Exposed Mechanism" in software means *the
algorithm shows its work*. The user always sees *why* a weight was prescribed
("+2.5 kg — last session felt easy"). Never a black box. The working internals
are the character of the product.

**Palette** (dark ground is functional: low glare in a bright gym, OLED battery,
high contrast for glance-parsing):

| Token          | Hex       | Use                                              |
|----------------|-----------|--------------------------------------------------|
| gunmetal       | `#0B0F14` | Background / ground                              |
| schematic-cyan | `#28C8D6` | Primary interactive, active state, key data      |
| copper         | `#CF8A4E` | Secondary accent, progression indicators         |
| gold           | `#E8C36B` | Sparing highlight (PRs, milestones only)          |
| hazard         | `#E8623A` | **Warnings only** — deload, injury, form-broke   |
| slate          | `#8FA0AE` | Labels, secondary text, inactive                 |

Hazard-orange is semantic. Never use it decoratively. It means "the system is
about to reduce load / block a movement."

**Typography:**
- Chakra Petch — labels, buttons, headings.
- IBM Plex Mono — all numeric data (loads, reps, sets, timers, dates).

**Build plate:** the About/Settings screen carries a stamped data-plate block —
maker, build ID, REV, build DTG (Zulu). This is informational (version
provenance), not ornament.

**Reject:** generic sci-fi, neon, purple/cyberpunk, gradients-for-their-own-sake,
glassmorphism, drop-shadow soup. If the UI could be any startup's app with a
palette swap, it is wrong.

## 4. Stack

Default: **Expo (React Native) + TypeScript**, strict mode. Rationale: fastest
solo build loop (Expo Go on-device testing), largest ecosystem, TypeScript type
safety, and a clean native path to Bluetooth sensor integration later if v2
wants it (Web Bluetooth is not available on iOS Safari, which would rule out a
PWA for that future).

If the maintainer overrides to Flutter or a PWA, honor it — but flag the sensor
tradeoff above once, then proceed.

State: start with a single store (Zustand or Redux Toolkit) + local persistence
(SQLite via `expo-sqlite` or `op-sqlite`). Workout history is relational and
queried by muscle group across time — a document store will fight you. Justify
any deviation.

## 5. Code conventions

**Tier 0 (universal, non-negotiable):**
- Clarity first — the code must read cold at 0200 during a debug session.
- Comment the *why*, not the *what*. Never narrate self-evident lines.
- No magic numbers. Named constants, with units in the name when dimensional
  (`REST_DEFAULT_SEC`, `DELOAD_FRACTION`, `PLATE_INCREMENT_KG`).
- Handle errors explicitly. No silent failure, no empty `catch`.
- Concise beats thorough-looking. Fewer lines that do the job.

**Tier 1 (embedded-C hierarchical naming, data-plate banners): DOES NOT APPLY.**
This is TypeScript, not flight firmware. Applying `fun_`/`Var_` symbol grammar or
per-file data-plate banners here is noise and violates function-earns-keep. Use
idiomatic TypeScript: `camelCase` values/functions, `PascalCase` types and
components, `SCREAMING_SNAKE` module constants.

**All algorithm thresholds live in one config module** — `progressionConfig.ts` —
as named, documented, tunable constants. Deload fraction, grind-repeat trigger
count, per-lift increment sizes, rep-range windows. Nothing hardcoded inline in
the progression engine. This is the difference between a system I can tune and a
pile of guesses.

## 6. Physiology guardrails

The training logic in the PRD came from a brainstorm and carries some false
precision. Build to the corrected model below, not the naive spec.

1. **Progression is double-progression, generally.** Advance reps within a target
   range, *then* add load. Compounds and isolations differ by their rep-range
   window and increment size — **not** by a hard "compounds add weight /
   isolations add reps" split. A pure linear-load model on compounds stalls fast
   past the novice phase. Encode: `{repRangeLow, repRangeHigh, incrementKg}` per
   exercise class.

2. **Load conversions are seeds, not constants.** When swapping barbell → dumbbell
   ("Equipment Taken"), there is no physiologically exact conversion ratio — it
   varies by lift, stabilizer demand, and individual. Seed a rough starting
   estimate, then let the Post-Set feedback loop correct it on the first set.
   Do **not** build a false-precision conversion table and present it as truth.
   The correction mechanism already exists in the design; use it.

3. **Auto-regulation operates within a program, not instead of one.** A recommender
   that only picks "the freshest muscle today" produces incoherent training — no
   progressive-overload arc, no planned weekly volume. Fatigue-reactivity must
   sit *inside* a mesocycle structure (per-muscle weekly volume target, a
   progression arc). Keep the training goal represented in state; do not let the
   day-to-day loop drift the program away from what the user is training *for*.

4. **Deload is tunable and reactive-with-a-note.** Repeated "Grind" → reduce load
   by `DELOAD_FRACTION` (default 0.10). Fine as a default, but reactive-only can
   lag accumulated fatigue; leave room for an optional scheduled deload
   (every N weeks). Constant, not magic number.

5. **Taxonomy: primary + secondary required, tertiary optional.** Tertiary muscle
   activation is frequently trivial and can add noise to fatigue accounting.
   Include it only where it earns its keep (e.g., triceps as a real secondary in
   heavy pressing, which *must* be tracked so the app won't program triceps
   isolation the same day).

When you implement any of the above, cite the constant and its default in a
comment; do not bury tuning parameters.

## 7. Working discipline

- Keep the mission goal visible: the app exists to progress the user's training
  safely. A local fix that suppresses a symptom but pulls the design away from
  that (e.g., a UI shortcut that hides the algorithm's reasoning) is not a win —
  flag the tension.
- Label workarounds as workarounds. State what they solve, what they don't, and
  what the root-cause fix would require.
- Small, reviewable commits. Conventional-commit style is fine, not mandatory.
