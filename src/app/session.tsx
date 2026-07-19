import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyHeatMap } from '@/components/BodyHeatMap';
import { MuscleMap } from '@/components/MuscleMap';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG, getExerciseById } from '@/data/exerciseCatalog';
import { CUSTOM_GYM_PROFILE_ID } from '@/domain/types';
import { filterAvailableExercises } from '@/domain/equipment';
import {
  COMPONENT_LABELS,
  MUSCLE_COMPONENTS_BY_GROUP,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '@/domain/types';
import { formatLoad, unitSuffix } from '@/domain/units';
import {
  accumulateCoverage,
  groupCoverage,
  rankExercisesForSession,
} from '@/engine/recommendation';
import type { TimestampedSessionResult } from '@/persistence/types';
import { getProfileById, useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

const MS_PER_DAY = 86_400_000;

/** "LAST 60 KG × 8 · 4D AGO" — the row-level memory of this movement. */
function lastResultLine(
  history: readonly TimestampedSessionResult[] | undefined,
  unit: Parameters<typeof formatLoad>[1],
): string | null {
  const last = history?.[history.length - 1];
  if (!last) return null;
  const days = Math.floor((Date.now() - Date.parse(last.completedAtIso)) / MS_PER_DAY);
  const when = days <= 0 ? 'TODAY' : `${days}D AGO`;
  return `LAST ${formatLoad(last.loadKg, unit)} ${unitSuffix(unit)} × ${last.repsAchieved} · ${when}`;
}

/**
 * Session flow, two modes on one route:
 *   /session                → picker: gym profile + muscle-group focus
 *   /session?muscleGroup=x  → the recommender view for that focus
 * The session itself (clock, completed work) survives focus changes and
 * picker visits; only END SESSION closes it. The coverage strip and
 * per-row rationale keep the algorithm's reasoning on screen at all times
 * (Exposed Mechanism) — never a black-box ordering.
 */
export default function SessionScreen() {
  const { muscleGroup } = useLocalSearchParams<{ muscleGroup: string }>();
  const selectedProfileId = useAppStore((state) => state.selectedGymProfileId);
  const selectGymProfile = useAppStore((state) => state.selectGymProfile);
  const customGym = useAppStore((state) => state.customGym);
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const activeSession = useAppStore((state) => state.activeSession);
  const startSession = useAppStore((state) => state.startSession);
  const endSession = useAppStore((state) => state.endSession);

  const targetGroup = MUSCLE_GROUPS.includes(muscleGroup as MuscleGroup)
    ? (muscleGroup as MuscleGroup)
    : null;

  useEffect(() => {
    if (targetGroup && activeSession?.muscleGroup !== targetGroup) {
      startSession(targetGroup);
    }
  }, [targetGroup, activeSession, startSession]);

  const onEndSessionShared = () => {
    endSession();
    // replace, not push: the ended session must not sit on the back stack.
    router.replace('/summary');
  };

  if (!targetGroup) {
    const pickerProfile = getProfileById(selectedProfileId, customGym);
    const profiles = customGym.enabled
      ? [...DEFAULT_GYM_PROFILES, getProfileById(CUSTOM_GYM_PROFILE_ID, customGym)]
      : [...DEFAULT_GYM_PROFILES];
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable
            testID="back-to-home"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonLabel}>‹ HOME</Text>
          </Pressable>

          <Text style={styles.kicker}>GYM PROFILE</Text>
          <View style={styles.chipRow}>
            {profiles.map((p) => {
              const active = p.id === pickerProfile.id;
              return (
                <Pressable
                  key={p.id}
                  testID={`profile-${p.id}`}
                  onPress={() => selectGymProfile(p.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {p.name.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.kicker}>
            {activeSession ? 'SWITCH FOCUS' : 'WHAT ARE YOU TRAINING?'}
          </Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map((group) => (
              <Pressable
                key={group}
                testID={`train-${group}`}
                onPress={() => router.replace({ pathname: '/session', params: { muscleGroup: group } })}
                style={styles.muscleButton}
              >
                <MuscleMap group={group} />
                <Text style={styles.muscleButtonLabel}>{group.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          {activeSession && (
            <Pressable testID="end-session" onPress={onEndSessionShared} style={styles.endButton}>
              <Text style={styles.endButtonLabel}>END SESSION</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const profile = getProfileById(selectedProfileId, customGym);
  const completedExercises = (activeSession?.completedExerciseIds ?? [])
    .map((id) => getExerciseById(id))
    .filter((exercise): exercise is Exercise => exercise !== undefined);
  const coverage = accumulateCoverage(completedExercises);
  const groupPercents = groupCoverage(coverage);
  const ranked = rankExercisesForSession({
    catalog: EXERCISE_CATALOG,
    profile,
    targetGroup,
    completedExercises,
  });

  // The rest of the gym stays one scroll away — the focus ranks the list,
  // it never locks the user in ("mix if you want").
  const rankedIds = new Set(ranked.map((entry) => entry.exercise.id));
  const completedIds = new Set(completedExercises.map((exercise) => exercise.id));
  const offTarget = filterAvailableExercises(EXERCISE_CATALOG, profile).filter(
    (exercise) => !rankedIds.has(exercise.id) && !completedIds.has(exercise.id),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Focus switch, not session exit — completed work and clock survive. */}
        <Pressable
          testID="back-to-groups"
          onPress={() => router.replace('/session')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonLabel}>‹ MUSCLE GROUPS</Text>
        </Pressable>

        <Text style={styles.kicker}>
          {targetGroup.toUpperCase()} — {profile.name.toUpperCase()}
        </Text>

        {/* Coverage strip: per-component state, the recommender's working memory. */}
        <View style={styles.coverageRow}>
          {MUSCLE_COMPONENTS_BY_GROUP[targetGroup].map((component) => {
            const covered = Math.min(1, coverage[component] ?? 0);
            const worked = covered > 0;
            return (
              <View key={component} style={[styles.coverageChip, worked && styles.coverageChipHit]}>
                <Text style={[styles.coverageLabel, worked && styles.coverageLabelHit]}>
                  {COMPONENT_LABELS[component].toUpperCase()}
                </Text>
                <Text style={[styles.coveragePercent, worked && styles.coverageLabelHit]}>
                  {Math.round(covered * 100)}%
                </Text>
              </View>
            );
          })}
        </View>

        {/* Whole-body view: what today's work has reached, muscle by muscle. */}
        <Text style={styles.sectionTitle}>FULL BODY TODAY</Text>
        <BodyHeatMap intensityByGroup={groupPercents} scale={1.5} />
        <View style={styles.groupPctRow}>
          {MUSCLE_GROUPS.map((group) => {
            const pct = Math.round(Math.min(1, groupPercents[group]) * 100);
            return (
              <Text key={group} style={[styles.groupPct, pct > 0 && styles.groupPctLit]}>
                {group.toUpperCase()} {pct}%
              </Text>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>UP NEXT</Text>
        {ranked.length === 0 && (
          <Text style={styles.rationale}>
            Nothing available for this group at this gym — switch profiles on Home.
          </Text>
        )}
        {ranked.map(({ exercise, rationale }) => {
          const lastLine = lastResultLine(historyByExercise[exercise.id], unitPreference);
          return (
            <Pressable
              key={exercise.id}
              testID={`recommend-${exercise.id}`}
              onPress={() =>
                router.push({ pathname: '/workout', params: { exerciseId: exercise.id } })
              }
              style={styles.row}
            >
              <Text style={styles.rowName}>{exercise.name}</Text>
              <Text style={styles.rowRationale}>{rationale}</Text>
              {lastLine && <Text style={styles.rowLast}>{lastLine}</Text>}
            </Pressable>
          );
        })}

        {offTarget.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>EVERYTHING ELSE</Text>
            {offTarget.map((exercise) => {
              const lastLine = lastResultLine(historyByExercise[exercise.id], unitPreference);
              return (
                <Pressable
                  key={exercise.id}
                  testID={`mix-${exercise.id}`}
                  onPress={() =>
                    router.push({ pathname: '/workout', params: { exerciseId: exercise.id } })
                  }
                  style={styles.row}
                >
                  <Text style={styles.rowName}>{exercise.name}</Text>
                  <Text style={styles.rowMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
                  {lastLine && <Text style={styles.rowLast}>{lastLine}</Text>}
                </Pressable>
              );
            })}
          </>
        )}

        {completedExercises.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>DONE TODAY</Text>
            {completedExercises.map((exercise) => (
              <View key={exercise.id} style={styles.doneRow}>
                <Text style={styles.doneCheck}>✓</Text>
                <Text style={styles.doneName}>{exercise.name}</Text>
              </View>
            ))}
          </>
        )}

        <Pressable testID="end-session" onPress={onEndSessionShared} style={styles.endButton}>
          <Text style={styles.endButtonLabel}>END SESSION</Text>
        </Pressable>
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
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    borderColor: palette.schematicCyan,
  },
  chipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
    textAlign: 'center',
  },
  chipLabelActive: {
    color: palette.schematicCyan,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Focus pick is the screen's primary action: 64pt floor, two columns.
  muscleButton: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touchTarget.primaryMinPt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  muscleButtonLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  coverageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  coverageChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  coverageChipHit: {
    borderColor: palette.schematicCyan,
  },
  coverageLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  coverageLabelHit: {
    color: palette.schematicCyan,
  },
  coveragePercent: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  sectionTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  groupPctRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  groupPct: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  groupPctLit: {
    color: palette.schematicCyan,
  },
  // Recommendation rows are the session's primary action: 64pt floor.
  row: {
    minHeight: touchTarget.primaryMinPt,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surface,
    paddingVertical: spacing.sm,
  },
  rowName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  rowRationale: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  rowMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  rowLast: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.secondaryMinPt,
  },
  doneCheck: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
  },
  doneName: {
    color: palette.slate,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  endButton: {
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    marginTop: spacing.lg,
  },
  endButtonLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  rationale: {
    color: palette.copper,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.label,
    marginTop: spacing.md,
  },
});
