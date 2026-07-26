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
 * Week review — the shareable screen. One screenshot answers "is this
 * thing working?": biggest e1RM gains between each lift's last two
 * sessions, PRs in gold (the palette's one reserved celebration color),
 * week-over-week volume. Method stated on-screen: estimates, not
 * measurements (Exposed Mechanism).
 */
export default function ReviewScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const nowMs = Date.now();
  const review = buildWeekReview(historyByExercise, nowMs);
  const [top, ...rest] = review.movers;

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

        <View style={styles.titleRow}>
          <Text style={styles.kicker}>WEEK REVIEW</Text>
          <Text style={styles.window}>{windowLabel(nowMs)}</Text>
        </View>

        {!top && (
          <Text style={styles.emptyNote}>
            log two sessions of any lift this week and the review comes alive
          </Text>
        )}

        {top && (
          <>
            {review.prCount > 0 && (
              <Text style={styles.prHeadline}>
                ★ {review.prCount} PR{review.prCount === 1 ? '' : 'S'} THIS WEEK
              </Text>
            )}

            <View style={styles.hero}>
              <Text style={[styles.heroPct, top.isPr && styles.gold]}>{pct(top.growthPct)}</Text>
              <Text style={styles.heroName}>
                {nameOf(top.exerciseId)}
                {top.isPr ? '  ★ PR' : ''}
              </Text>
              <Text style={styles.heroCaption}>TOP GAIN — LAST TWO SESSIONS</Text>
            </View>

            <Text style={styles.volumeLine}>
              {review.volumeDeltaPct === null
                ? 'FIRST TRACKED WEEK — NO VOLUME BASELINE'
                : `VOLUME ${pct(review.volumeDeltaPct)} VS LAST WEEK`}
            </Text>

            {rest.map((mover) => (
              <View key={mover.exerciseId} style={styles.moverRow}>
                <Text
                  style={[
                    styles.moverPct,
                    mover.growthPct < 0 && styles.moverPctDown,
                    mover.isPr && styles.gold,
                  ]}
                >
                  {pct(mover.growthPct)}
                </Text>
                <Text style={styles.moverName}>{nameOf(mover.exerciseId)}</Text>
                {mover.isPr && <Text style={styles.prChip}>★ PR</Text>}
              </View>
            ))}

            <Text style={styles.method}>
              GROWTH = EST. 1RM (EPLEY), LAST TWO SESSIONS OF EACH LIFT
            </Text>
          </>
        )}

        {/* Share footer: a screenshot of this screen carries its provenance. */}
        <View style={styles.footerPlate}>
          <Text style={styles.footerText}>
            BALLAST · REV {Constants.expoConfig?.version ?? '0.0.0'} · {ABOUT.makerLink}
          </Text>
        </View>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
  },
  window: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  emptyNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  prHeadline: {
    color: palette.gold,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.md,
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
  volumeLine: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    minHeight: touchTarget.secondaryMinPt / 2,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surface,
  },
  moverPct: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.body,
    minWidth: 76,
  },
  moverPctDown: {
    color: palette.slate,
  },
  moverName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.label,
    flexShrink: 1,
  },
  prChip: {
    color: palette.gold,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  method: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footerPlate: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.slate,
    marginTop: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  footerText: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
});
