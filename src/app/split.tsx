import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MuscleMap } from '@/components/MuscleMap';
import { ScreenHeader } from '@/components/ScreenHeader';
import { deriveSplitName } from '@/domain/splits';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
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
 * Split builder — "a back and glutes day", "bi/tri day". A split is nothing
 * more than a named set of muscle groups, so this screen is nothing more
 * than a multi-select: no set schemes, no day-of-week scheduling, no
 * ordering. Those would be program-building, which the recommender already
 * does from the group list.
 *
 * Naming is optional: the name derives from the groups unless the user wants
 * their own. TextInput is permitted here — this is setup, not the active
 * workout flow (same precedent as the custom-exercise builder).
 */
export default function SplitBuilderScreen() {
  const addCustomSplit = useAppStore((state) => state.addCustomSplit);

  const [name, setName] = useState('');
  const [groups, setGroups] = useState<MuscleGroup[]>([]);

  // Selection order is preserved: "BACK + GLUTES" reads the way it was built.
  const toggleGroup = (group: MuscleGroup) =>
    setGroups((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );

  const derivedName = deriveSplitName(groups);
  const savable = groups.length > 0;

  const onSave = () => {
    if (!savable) return;
    const id = addCustomSplit({ name, muscleGroups: groups });
    if (id) router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="NEW SPLIT"
          back={{ label: "TODAY'S FOCUS", onPress: () => router.back() }}
          subtitle="a split is just a named set of muscles — pick them, save, train it"
        />

        <Text style={styles.fieldLabel}>MUSCLES IN THIS DAY</Text>
        <View style={styles.grid}>
          {MUSCLE_GROUPS.map((group) => {
            const picked = groups.includes(group);
            return (
              <Pressable
                key={group}
                testID={`split-muscle-${group}`}
                onPress={() => toggleGroup(group)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={`Include ${group} in this split`}
                style={(state) => [
                  styles.muscleButton,
                  picked && styles.muscleButtonPicked,
                  pressFeedback(state),
                ]}
              >
                <MuscleMap group={group} />
                <Text style={[styles.muscleLabel, picked && styles.muscleLabelPicked]}>
                  {group.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>NAME — OPTIONAL</Text>
        <TextInput
          testID="split-name"
          value={name}
          onChangeText={setName}
          placeholder={derivedName === '' ? 'pick muscles first' : derivedName}
          placeholderTextColor={palette.slate}
          style={styles.nameInput}
          maxLength={24}
        />
        <Text style={styles.note}>
          {savable
            ? `will show as ${(name.trim() === '' ? derivedName : name.trim()).toUpperCase()}`
            : 'pick at least one muscle group'}
        </Text>

        <Pressable
          testID="split-save"
          onPress={onSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !savable }}
          accessibilityLabel={
            savable ? 'Save this split' : 'Save split — pick at least one muscle group first'
          }
          style={(state) => [
            styles.saveButton,
            !savable && styles.saveButtonDisabled,
            pressFeedback(state),
          ]}
        >
          <Text style={[styles.saveLabel, !savable && styles.saveLabelDisabled]}>SAVE SPLIT</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Same 64pt two-column target as the session picker's muscle grid — this
  // is the same act of choosing, just saved for later.
  muscleButton: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touchTarget.primaryMinPt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  muscleButtonPicked: {
    borderColor: palette.schematicCyan,
  },
  muscleLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  muscleLabelPicked: {
    color: palette.schematicCyan,
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
  note: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.sm,
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
