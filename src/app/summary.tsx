import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

const MS_PER_MINUTE = 60_000;

/**
 * Post-session debrief. The energy figure is an ESTIMATE and says so — its
 * formula line renders verbatim (Exposed Mechanism), because a number
 * derived from a default body mass must never masquerade as measurement.
 */
export default function SummaryScreen() {
  const summary = useAppStore((state) => state.lastSessionSummary);

  if (!summary) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.assumptions}>No session data — start a workout from Home.</Text>
      </SafeAreaView>
    );
  }

  const durationMin = Math.round(summary.durationMs / MS_PER_MINUTE);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>SESSION COMPLETE</Text>

        <View style={styles.hero}>
          <Text style={styles.heroValue}>
            {summary.energy.kilojoules}
            <Text style={styles.heroUnit}> KJ</Text>
          </Text>
          <Text style={styles.heroSecondary}>≈ {summary.energy.kcal} kcal · ESTIMATE</Text>
          <Text style={styles.assumptions}>{summary.energy.rationale}</Text>
        </View>

        <View style={styles.statRow}>
          <Stat label="DURATION" value={`${durationMin}`} unit="MIN" />
          <Stat label="SETS" value={`${summary.setsCompleted}`} />
          <Stat label="EXERCISES" value={`${summary.exerciseNames.length}`} />
        </View>

        <Text style={styles.sectionTitle}>COMPLETED</Text>
        {summary.exerciseNames.map((name) => (
          <Text key={name} style={styles.exerciseName}>
            {name}
          </Text>
        ))}
        {summary.exerciseNames.length === 0 && (
          <Text style={styles.assumptions}>No exercises completed this session.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="summary-done" onPress={() => router.replace('/')} style={styles.doneButton}>
          <Text style={styles.doneButtonLabel}>DONE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroValue: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralHero,
  },
  heroUnit: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.heading,
  },
  heroSecondary: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
  },
  assumptions: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.numeralLarge,
  },
  statUnit: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
  },
  statLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
    paddingVertical: spacing.xs,
  },
  // Primary action pinned to the thumb zone.
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  doneButton: {
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  doneButtonLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
});
