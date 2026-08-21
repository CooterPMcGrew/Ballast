import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import {
  EQUIPMENT_TAGS,
  EXERCISE_CLASSES,
  MUSCLE_GROUPS,
  type EquipmentTag,
  type ExerciseClass,
  type MuscleGroup,
} from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * Custom exercise builder. The user's fear ("they'll enter garbage
 * percentages") is engineered out: there IS no percentage entry. Name,
 * class, equipment, and muscle roles only — activation shares are derived
 * by the same tested mechanism the stock catalog used before authoring.
 * TextInput is permitted here: this is setup, not the active-workout flow.
 */

type MuscleRole = 'none' | 'primary' | 'secondary';

export default function CustomExerciseScreen() {
  const addCustomExercise = useAppStore((state) => state.addCustomExercise);

  const [name, setName] = useState('');
  const [exerciseClass, setExerciseClass] = useState<ExerciseClass>('compound');
  const [equipment, setEquipment] = useState<EquipmentTag[]>(['bodyweight']);
  const [roles, setRoles] = useState<Partial<Record<MuscleGroup, MuscleRole>>>({});

  const toggleEquipment = (tag: EquipmentTag) =>
    setEquipment((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  // Tap cycles a muscle through none → primary → secondary → none.
  const cycleRole = (group: MuscleGroup) =>
    setRoles((current) => {
      const next: MuscleRole =
        current[group] === 'primary'
          ? 'secondary'
          : current[group] === 'secondary'
            ? 'none'
            : 'primary';
      return { ...current, [group]: next };
    });

  const primaryMuscles = MUSCLE_GROUPS.filter((group) => roles[group] === 'primary');
  const secondaryMuscles = MUSCLE_GROUPS.filter((group) => roles[group] === 'secondary');
  const savable = name.trim() !== '' && primaryMuscles.length > 0 && equipment.length > 0;

  const onSave = () => {
    if (!savable) return;
    const id = addCustomExercise({
      name,
      exerciseClass,
      equipment,
      primaryMuscles,
      secondaryMuscles,
    });
    if (id) router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="NEW EXERCISE"
          back={{ label: 'SETTINGS', onPress: () => router.back() }}
          subtitle="name it, say what it needs and what it works — the rest is derived"
        />

        <Text style={styles.fieldLabel}>NAME</Text>
        <TextInput
          testID="custom-name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Landmine Press"
          placeholderTextColor={palette.slate}
          style={styles.nameInput}
          maxLength={40}
        />

        <Text style={styles.fieldLabel}>TYPE</Text>
        <View style={styles.chipRow}>
          {EXERCISE_CLASSES.map((cls) => (
            <Pressable
              key={cls}
              testID={`class-${cls}`}
              onPress={() => setExerciseClass(cls)}
              accessibilityRole="radio"
              accessibilityState={{ selected: exerciseClass === cls }}
              accessibilityLabel={`${cls} exercise`}
              style={(state) => [
                styles.chip,
                exerciseClass === cls && styles.chipActive,
                pressFeedback(state),
              ]}
            >
              <Text style={[styles.chipLabel, exerciseClass === cls && styles.chipLabelActive]}>
                {cls.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>EQUIPMENT NEEDED</Text>
        <View style={styles.chipRow}>
          {EQUIPMENT_TAGS.map((tag) => (
            <Pressable
              key={tag}
              testID={`equip-${tag}`}
              onPress={() => toggleEquipment(tag)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: equipment.includes(tag) }}
              accessibilityLabel={`Needs ${tag}`}
              style={(state) => [
                styles.chip,
                equipment.includes(tag) && styles.chipActive,
                pressFeedback(state),
              ]}
            >
              <Text
                style={[styles.chipLabel, equipment.includes(tag) && styles.chipLabelActive]}
              >
                {tag.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>MUSCLES — TAP CYCLES PRIMARY / SECONDARY / OFF</Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((group) => {
            const role = roles[group] ?? 'none';
            return (
              <Pressable
                key={group}
                testID={`muscle-${group}`}
                onPress={() => cycleRole(group)}
                accessibilityRole="button"
                accessibilityState={{ selected: role !== 'none' }}
                accessibilityLabel={`${group}: ${role === 'none' ? 'not worked' : role} muscle. Tap to cycle.`}
                style={(state) => [
                  styles.chip,
                  role === 'primary' && styles.chipPrimary,
                  role === 'secondary' && styles.chipSecondary,
                  pressFeedback(state),
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    role === 'primary' && styles.chipLabelActive,
                    role === 'secondary' && styles.chipLabelSecondary,
                  ]}
                >
                  {group.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>
          activation percentages are derived automatically — nothing to mistype
        </Text>

        {/* A dimmed button with no stated reason is a dead end. Name the one
            thing still missing rather than leaving the user to guess. */}
        {!savable && (
          <Text style={styles.note}>
            {name.trim() === ''
              ? 'give it a name to save'
              : equipment.length === 0
                ? 'pick the equipment it needs'
                : 'mark at least one muscle as PRIMARY'}
          </Text>
        )}

        <Pressable
          testID="custom-save"
          onPress={onSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !savable }}
          accessibilityLabel={
            savable
              ? 'Save this exercise'
              : 'Save exercise — needs a name, equipment, and one primary muscle first'
          }
          style={(state) => [
            styles.saveButton,
            !savable && styles.saveButtonDisabled,
            pressFeedback(state),
          ]}
        >
          <Text style={[styles.saveLabel, !savable && styles.saveLabelDisabled]}>
            SAVE EXERCISE
          </Text>
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
  fieldLabel: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  nameInput: {
    minHeight: touchTarget.secondaryMinPt,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
    paddingHorizontal: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    borderColor: palette.schematicCyan,
  },
  chipPrimary: {
    borderColor: palette.schematicCyan,
  },
  chipSecondary: {
    borderColor: palette.copper,
  },
  chipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  chipLabelActive: {
    color: palette.schematicCyan,
  },
  chipLabelSecondary: {
    color: palette.copper,
  },
  note: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.md,
  },
  saveButton: {
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    borderColor: palette.slate,
  },
  saveLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  saveLabelDisabled: {
    color: palette.slate,
  },
});
