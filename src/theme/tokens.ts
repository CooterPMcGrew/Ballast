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

// Chakra Petch = labels/buttons/headings; IBM Plex Mono = ALL numeric data
// (loads, reps, timers, dates). Family names must match the keys registered
// with useFonts() in the root layout.
export const fontFamily = {
  display: 'ChakraPetch_600SemiBold',
  displayRegular: 'ChakraPetch_400Regular',
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_600SemiBold',
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

// Sweaty Finger floors (CLAUDE.md §2): deliberately above the 44pt HIG / 48dp
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
