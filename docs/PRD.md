# Ballast — Product Requirements

Source of truth for features. Operating rules and design system are in the root
`CLAUDE.md`. Voice/hands-free operation is **out of scope for v1** — removed from
the original brainstorm intentionally.

---

## 0. Philosophy

Zero-precision UI. The user is tired, headphones on, glancing between
sets. The app is an active auto-regulating trainer: it prescribes the next set,
the user reports the result in one tap, the app adjusts. No standard keyboard
during an active workout. Not a passive logbook.

## 1. Navigation & architecture

**Gym Profiles (equipment context).** The user picks an environment: Home Gym,
Commercial, Hotel, or a custom profile. Each profile carries equipment tags; the
selected profile globally filters the exercise database to what is actually
available.
- Manual selection is primary. Last-used profile is the default on open.
- GPS auto-suggest is an *optional convenience* — it may pre-highlight a likely
  profile, but it must never block the app from opening and must never be the
  only path. (GPS is weak indoors; geofences overlap; picking a gym is a
  low-frequency, low-cost tap.)

**Recommendation ("what should I do today").** The Home screen leads with
"Recommended for Today" — not a blank list of muscle groups. Generated from
recent per-muscle fatigue and the selected gym profile.
- **Constraint:** the recommender operates *within* a program structure (weekly
  per-muscle volume targets, a progression arc), not as a pure "pick the freshest
  muscle" heuristic. See Design Decision D3.

## 2. Active workout — the core loop

- **Default state:** current exercise, with prescribed load and reps, displayed
  prominently in monospace, glance-readable.
- **Primary action:** one large "Complete as Suggested" button (≥ 64pt).
- **Manual adjustment:** oversized `+` / `-` steppers (or a scroll wheel) for load
  and reps. No text-input fields.
- **Post-Set Matrix (progression signal):** on completing a set, three large
  buttons replace RPE / failure checkboxes. This is the sole per-set input to the
  progression engine:
  1. **Felt Easy** → aggressive progression next session.
  2. **Just Right** → micro-progression.
  3. **Grind / Form Broke** → halt progression; repeat occurrences trigger a
     deload (default 10%, tunable — see D4).

## 3. Edge cases — the "..." menu

Every active-exercise screen has a high-visibility Options button for real-world
gym friction.

- **Equipment Taken.** Remove the current exercise; show a modal of ranked
  substitute movements (e.g., barbell bench → dumbbell bench). Seed a *translated
  starting load* as an estimate, then let the Post-Set feedback loop correct it.
  (These are ranked substitutes, not true 1:1 equivalents — see D2.)
- **Injury / Pain.** Kill the current exercise; prompt "Avoid this muscle/joint
  for how long?" (Today / 1 Week / 1 Month). The recommender blacklists that area
  for the chosen window.

## 4. Search & customization

- **Add Exercise** (during a workout): the modal defaults to a list filtered to
  the current day's physiological focus (e.g., only Pull movements on a Pull day).
- **Override toggle:** `[Current Focus] | [All Exercises]` at the top of the
  modal. Selecting an out-of-scope exercise logs fatigue debt for the involved
  muscle groups and adjusts subsequent recommendations.

## 5. Backend logic

- **Progression model — double progression (asymmetric by class).** Advance reps
  within a target range, then add load. Compound and isolation lifts differ by
  rep-range window and increment size, encoded per exercise class — *not* a hard
  weight-only vs reps-only split. See D1.
- **Exercise taxonomy & fatigue debt.** Every exercise is tagged with **primary
  and secondary** muscle groups (tertiary optional, only where it earns its keep).
  This drives fatigue accounting so the engine will not, e.g., program triceps
  isolation on a day the user fried triceps as a secondary mover under heavy
  pressing.

---

## Design Decisions (D#) — captured critique

These correct or qualify the original brainstorm. Rationale lives here so it is
not lost; enforcement lives in `CLAUDE.md` §6.

- **D1 — Progression generalized to double progression.** Original: "compounds
  progress by weight, isolations by reps." Corrected: double progression for
  both, differing by rep-range and increment. A pure linear-load model on
  compounds stalls past the novice phase. Evidence-aligned, standard practice.

- **D2 — Load conversion is a seed, not a constant.** No physiologically exact
  barbell↔dumbbell ratio exists (varies by lift, stabilizer demand, individual).
  Do not build a false-precision conversion table. Seed an estimate; the Post-Set
  loop is the real correction mechanism — which already exists in the design.

- **D3 — Auto-regulation ⊂ a program, not a replacement for one.** A purely
  fatigue-reactive recommender produces incoherent training (no overload arc, no
  weekly volume plan). Fatigue-reactivity must sit inside a mesocycle structure.
  This is the highest-priority architectural note: keep the training *goal* in
  state, or the day-to-day loop drifts the program away from what it is for.

- **D4 — Deload tunable, reactive-with-a-caveat.** 10% load reduction on repeated
  "Grind" is a reasonable default but arbitrary; make it a named constant.
  Reactive-only deloading can lag accumulated fatigue — leave room for an optional
  scheduled deload (every N weeks).

- **D5 — 3-button feedback trades resolution for reliability.** Collapsing
  RPE/RIR (reps-in-reserve) to three states fits the zero-precision principle and
  sidesteps the well-known noise in novice self-rated RPE. Accepted cost: you lose
  the ability to distinguish "hard, 2 in reserve" from "true failure," which
  reduces progression precision. Acceptable for v1.

- **D6 — GPS is convenience, manual is primary.** Do not gate app-open on a GPS
  lock. Fast manual picker with last-used default is more robust and cheaper.
