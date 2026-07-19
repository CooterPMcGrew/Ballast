import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXERCISE_CATALOG, getExerciseById } from '@/data/exerciseCatalog';
import { filterAvailableExercises } from '@/domain/equipment';
import {
  COMPONENT_LABELS,
  MUSCLE_COMPONENTS_BY_GROUP,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '@/domain/types';
import { accumulateCoverage, rankExercisesForSession } from '@/engine/recommendation';
import { getProfileById, useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

/**
 * Session page: the recommender's home. The user declared a target group on
 * Home; this screen ranks the gym's available movements by uncovered
 * components and RE-RANKS after every completed exercise. The coverage strip
 * and per-row rationale keep the algorithm's reasoning on screen at all
 * times (Exposed Mechanism) — never a black-box ordering.
 */
export default function SessionScreen() {
  const { muscleGroup } = useLocalSearchParams<{ muscleGroup: string }>();
  const selectedProfileId = useAppStore((state) => state.selectedGymProfileId);
  const customGym = useAppStore((state) => state.customGym);
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

  if (!targetGroup) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.rationale}>Unknown muscle group — go back and pick again.</Text>
      </SafeAreaView>
    );
  }

  const profile = getProfileById(selectedProfileId, customGym);
  const completedExercises = (activeSession?.completedExerciseIds ?? [])
    .map((id) => getExerciseById(id))
    .filter((exercise): exercise is Exercise => exercise !== undefined);
  const coverage = accumulateCoverage(completedExercises);
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

  const onEndSession = () => {
    endSession();
    // replace, not push: the ended session must not sit on the back stack.
    router.replace('/summary');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Focus switch, not session exit — completed work and clock survive. */}
        <Pressable testID="back-to-groups" onPress={() => router.back()} style={styles.backButton}>
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

        <Text style={styles.sectionTitle}>UP NEXT</Text>
        {ranked.length === 0 && (
          <Text style={styles.rationale}>
            Nothing available for this group at this gym — switch profiles on Home.
          </Text>
        )}
        {ranked.map(({ exercise, rationale }) => (
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
          </Pressable>
        ))}

        {offTarget.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>EVERYTHING ELSE</Text>
            {offTarget.map((exercise) => (
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
              </Pressable>
            ))}
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

        <Pressable testID="end-session" onPress={onEndSession} style={styles.endButton}>
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
