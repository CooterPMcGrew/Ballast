// Design tokens — "Exposed Mechanism" (CLAUDE.md §3).
// Dark ground is functional, not aesthetic: low glare in a bright gym, OLED
// battery, high contrast for glance-parsing between sets.

export const palette = {
  /** Background / ground. */
  gunmetal: '#0B0F14',
  /** One step above ground for cards/panels — a lifted gunmetal, not a new hue. */
  surface: '#131A22',
  /** Primary interactive, active state, key data. */
  schematicCyan: '#28C8D6',
  /** Secondary accent, progression indicators. */
  copper: '#CF8A4E',
  /** Sparing highlight — PRs and milestones ONLY. */
  gold: '#E8C36B',
  /**
   * SEMANTIC, never decorative: means "the system is about to reduce load or
   * block a movement" (deload, injury, form-broke).
   */
  hazard: '#E8623A',
  /** Labels, secondary text, inactive states. */
  slate: '#8FA0AE',
  /** Primary reading text on gunmetal — near-white, cooled to match the ground. */
  textPrimary: '#E6EDF3',
} as const;

// One family everywhere: JetBrains Mono — the type developers live in.
// All-mono UI reads as instrument panel / terminal, which IS the Exposed
// Mechanism aesthetic; weight (not family) carries the hierarchy. Token
// names kept so call sites didn't change; names must match useFonts().
export const fontFamily = {
  display: 'JetBrainsMono_700Bold',
  displayRegular: 'JetBrainsMono_400Regular',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_800ExtraBold',
} as const;

// Type scale (pt). The two numeral sizes exist because prescribed load/reps
// must read at arm's length mid-set — that floor is the point of the scale.
export const fontSize = {
  /** Prescribed load — the single most glanced-at number in the app. */
  numeralHero: 64,
  /** Secondary numerals: reps, timer, set count. */
  numeralLarge: 32,
  heading: 20,
  body: 16,
  label: 14,
  caption: 12,
} as const;

// Zero-precision floors (CLAUDE.md §2): deliberately above the 44pt HIG / 48dp
// Material minimums because the user is tired and cannot aim.
export const touchTarget = {
  primaryMinPt: 64,
  secondaryMinPt: 48,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Universal press acknowledgment — the sub-100ms "I felt that" every
 * interactive surface must give while the finger is still down. Slight
 * dim + shrink reads as physical depression without competing with the
 * palette's semantic colors. Pass to any Pressable's style function.
 */
export const pressFeedback = ({ pressed }: { pressed: boolean }) =>
  pressed ? { opacity: 0.55, transform: [{ scale: 0.98 }] } : null;

/**
 * Motion durations (ms). Motion here does one job: make a change of state
 * legible. A control that swaps contents instantly reads as a glitch; one
 * that takes half a second wastes a tired user's time between sets. These
 * are the two points on that curve, and nothing animates without one.
 */
export const motion = {
  /** In-place content swap (workout working → feedback → resting). */
  phaseSwapMs: 180,
  /** List re-rank glide — the recommender visibly showing its work. */
  rerankMs: 300,
} as const;

/**
 * Post-Set Matrix semantics carried into any set visualization (blocks,
 * log rows): the same three colors as the buttons that recorded them.
 * Hazard here is semantic, not decorative — a grind block IS a warning.
 */
export const feedbackColor = {
  easy: palette.schematicCyan,
  justRight: palette.copper,
  grind: palette.hazard,
} as const;
