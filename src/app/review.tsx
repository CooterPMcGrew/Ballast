import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ABOUT } from '@/config/about';
import { getExerciseById } from '@/data/exerciseCatalog';
import { buildWeekReview } from '@/engine/weekReview';
import { useAppStore } from '@/store/appStore';
import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

const MS_PER_DAY = 86_400_000;

/** The card stays one glance deep — hero plus this many bars, no scroll-soup. */
const CARD_MOVERS_MAX = 4;

/** "JUL 18 — JUL 25" from the trailing 7-day window. */
function windowLabel(nowMs: number): string {
  const monthDay = (ms: number) => {
    const parts = new Date(ms).toDateString().split(' ');
    return `${parts[1]} ${parts[2]}`.toUpperCase();
  };
  return `${monthDay(nowMs - 7 * MS_PER_DAY)} — ${monthDay(nowMs)}`;
}

/** "+5.5%" / "−3.8%" — sign always shown; growth without direction is noise. */
function pct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}

/**
 * Week review — one framed, screenshot-shaped card. The share flow IS the
 * OS screenshot: no export machinery, no share SDK (simplicity is the
 * moat). Hero gain, PR stars in gold, magnitude bars for the rest, and
 * the method + provenance printed on the card so a shared image carries
 * its own caveat and its maker's mark.
 */
export default function ReviewScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const nowMs = Date.now();
  const review = buildWeekReview(historyByExercise, nowMs);
  const [top, ...others] = review.movers;
  const bars = others.slice(0, CARD_MOVERS_MAX);
  const barScale = Math.max(...bars.map((mover) => Math.abs(mover.growthPct)), 1);

  const nameOf = (exerciseId: string) =>
    getExerciseById(exerciseId)?.name.toUpperCase() ?? exerciseId.toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          testID="review-back"
          onPress={() => router.back()}
          style={(state) => [styles.backButton, pressFeedback(state)]}
        >
          <Text style={styles.backButtonLabel}>‹ HOME</Text>
        </Pressable>

        {!top && (
          <Text style={styles.emptyNote}>
            log two sessions of any lift this week and the review comes alive
          </Text>
        )}

        {top && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.wordmark}>BALLAST</Text>
              <Text style={styles.window}>{windowLabel(nowMs)}</Text>
            </View>
            <View style={styles.divider} />

            {review.prCount > 0 && (
              <Text style={styles.prHeadline}>
                ★ {review.prCount} PR{review.prCount === 1 ? '' : 'S'} THIS WEEK
              </Text>
            )}

            <View style={styles.hero}>
              <Text style={[styles.heroPct, top.isPr && styles.gold]}>{pct(top.growthPct)}</Text>
              <Text style={styles.heroName}>
                {nameOf(top.exerciseId)}
                {top.isPr ? '  ★' : ''}
              </Text>
              <Text style={styles.heroCaption}>TOP GAIN THIS WEEK</Text>
            </View>

            {bars.map((mover) => {
              const color = mover.isPr
                ? palette.gold
                : mover.growthPct >= 0
                  ? palette.schematicCyan
                  : palette.slate;
              return (
                <View key={mover.exerciseId} style={styles.moverBlock}>
                  <View style={styles.moverLine}>
                    <Text style={styles.moverName}>
                      {nameOf(mover.exerciseId)}
                      {mover.isPr ? ' ★' : ''}
                    </Text>
                    <Text style={[styles.moverPct, { color }]}>{pct(mover.growthPct)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${(Math.abs(mover.growthPct) / barScale) * 100}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}

            <Text style={styles.volumeLine}>
              {review.volumeDeltaPct === null
                ? 'FIRST TRACKED WEEK'
                : `VOLUME ${pct(review.volumeDeltaPct)} VS LAST WEEK`}
            </Text>

            <View style={styles.divider} />
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>
                EST. 1RM (EPLEY) · {ABOUT.makerLink} · REV{' '}
                {Constants.expoConfig?.version ?? '0.0.0'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.gunmetal,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingRight: spacing.md,
  },
  backButtonLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  emptyNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.md,
  },
  // The shareable frame: everything a posted screenshot needs, nothing else.
  card: {
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  wordmark: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 3,
  },
  window: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.slate,
    marginVertical: spacing.md,
  },
  prHeadline: {
    color: palette.gold,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroPct: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralHero,
  },
  heroName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 1,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  heroCaption: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  gold: {
    color: palette.gold,
  },
  moverBlock: {
    marginBottom: spacing.md,
  },
  moverLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  moverName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.label,
    flexShrink: 1,
  },
  moverPct: {
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.label,
    marginLeft: spacing.sm,
  },
  barTrack: {
    height: 3,
    backgroundColor: palette.gunmetal,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
  },
  volumeLine: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cardFooter: {
    alignItems: 'center',
  },
  footerText: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
