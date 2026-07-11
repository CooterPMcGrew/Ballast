import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import { filterAvailableExercises } from '@/domain/equipment';
import type { Exercise } from '@/domain/types';
import { getProfileById, useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

/**
 * Home. Gym profile is a manual pick (PRD D6) that globally filters the
 * catalog. "Recommended for Today" arrives with the recommender; until then
 * the screen shows the honest state: the movement pool the profile unlocks.
 */
export default function HomeScreen() {
  const selectedProfileId = useAppStore((state) => state.selectedGymProfileId);
  const selectGymProfile = useAppStore((state) => state.selectGymProfile);

  const profile = getProfileById(selectedProfileId);
  const available = filterAvailableExercises(EXERCISE_CATALOG, profile);
  const compounds = available.filter((e) => e.exerciseClass === 'compound');
  const isolations = available.filter((e) => e.exerciseClass === 'isolation');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>GYM PROFILE</Text>
        <View style={styles.chipRow}>
          {DEFAULT_GYM_PROFILES.map((p) => {
            const active = p.id === profile.id;
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

        <View style={styles.poolHeader}>
          <Text style={styles.kicker}>MOVEMENT POOL</Text>
          <Text style={styles.poolCount}>
            {available.length}/{EXERCISE_CATALOG.length}
          </Text>
        </View>

        <ExerciseGroup title="COMPOUND" exercises={compounds} />
        <ExerciseGroup title="ISOLATION" exercises={isolations} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseGroup({ title, exercises }: { title: string; exercises: Exercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {exercises.map((exercise) => (
        <View key={exercise.id} style={styles.row}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          <Text style={styles.rowMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
        </View>
      ))}
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
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
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
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  poolCount: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  row: {
    minHeight: touchTarget.secondaryMinPt,
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
  rowMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
});
