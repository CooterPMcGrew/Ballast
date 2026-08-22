import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ABOUT } from '@/config/about';
import buildInfo from '@/config/buildInfo.json';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { CUSTOM_GYM_PRESETS } from '@/domain/equipment';
import {
  CUSTOM_GYM_PROFILE_ID,
  EQUIPMENT_TAGS,
  UNIT_PREFERENCES,
  type EquipmentTag,
  type Exercise,
  type UnitPreference,
} from '@/domain/types';
import { persistence } from '@/persistence';
import { buildExportPayload, exportFileName } from '@/persistence/export';
import { saveExportFile } from '@/persistence/saveExport';
import { getProfileById, useAppStore } from '@/store/appStore';
import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * Settings: units, the user's own gym, data export, and the stamped data
 * plate (CLAUDE.md §3 — version provenance, not ornament). Login/profiles
 * deliberately absent for now (maintainer call: not useful for prototyping).
 */
export default function SettingsScreen() {
  const unitPreference = useAppStore((state) => state.unitPreference);
  const setUnitPreference = useAppStore((state) => state.setUnitPreference);
  const customGym = useAppStore((state) => state.customGym);
  const setCustomGym = useAppStore((state) => state.setCustomGym);
  const selectedGymProfileId = useAppStore((state) => state.selectedGymProfileId);
  const selectGymProfile = useAppStore((state) => state.selectGymProfile);

  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const customExercises = useAppStore((state) => state.customExercises);
  const removeCustomExercise = useAppStore((state) => state.removeCustomExercise);
  const customSplits = useAppStore((state) => state.customSplits);
  const removeCustomSplit = useAppStore((state) => state.removeCustomSplit);
  const [confirmingSplitId, setConfirmingSplitId] = useState<string | null>(null);

  // The stock profiles, plus the user's own only while it is switched on —
  // an off custom gym is not a place you can be training.
  const activeProfile = getProfileById(selectedGymProfileId, customGym);
  const gymProfiles = customGym.enabled
    ? [...DEFAULT_GYM_PROFILES, getProfileById(CUSTOM_GYM_PROFILE_ID, customGym)]
    : [...DEFAULT_GYM_PROFILES];

  // Submission = a mail the USER consciously sends; the app itself never
  // phones home. Opens their mail client pre-filled for maker review.
  const submitExercise = (exercise: Exercise) => {
    const body =
      `Custom exercise submission for the Ballast catalog:\n\n` +
      `${JSON.stringify(exercise, null, 2)}\n\n` +
      `Sent from Ballast v${Constants.expoConfig?.version ?? '0.0.0'}`;
    const url =
      `mailto:${ABOUT.submissionsEmail}` +
      `?subject=${encodeURIComponent(`Ballast exercise: ${exercise.name}`)}` +
      `&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch((error) => {
      console.error('submitExercise: no mail handler', error);
      setExportStatus('no mail app available on this device');
    });
  };

  const onDeleteCustom = (exerciseId: string) => {
    if (confirmingDeleteId !== exerciseId) {
      setConfirmingDeleteId(exerciseId);
      return;
    }
    setConfirmingDeleteId(null);
    removeCustomExercise(exerciseId);
  };

  const onDeleteSplit = (splitId: string) => {
    if (confirmingSplitId !== splitId) {
      setConfirmingSplitId(splitId);
      return;
    }
    setConfirmingSplitId(null);
    removeCustomSplit(splitId);
  };

  const toggleEquipment = (tag: EquipmentTag) => {
    const equipment = customGym.equipment.includes(tag)
      ? customGym.equipment.filter((t) => t !== tag)
      : [...customGym.equipment, tag];
    setCustomGym({ ...customGym, equipment });
  };

  const onExport = async () => {
    try {
      const rows = await persistence.loadAllSessionRows();
      const exportedAtIso = new Date().toISOString();
      const payload = buildExportPayload(rows, {
        exportedAtIso,
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
        selectedGymProfileId,
        unitPreference,
      });
      await saveExportFile(JSON.stringify(payload, null, 2), exportFileName(exportedAtIso));
      setExportStatus(`${rows.length} ${rows.length === 1 ? 'set' : 'sets'} exported`);
    } catch (error) {
      console.error('export failed', error);
      setExportStatus('export failed — see logs');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="SETTINGS" back={{ label: 'HOME', onPress: () => router.back() }} />

        <Text style={styles.kicker}>UNITS</Text>
        <View style={styles.chipRow}>
          {UNIT_PREFERENCES.map((unit) => (
            <Chip
              key={unit}
              testID={`unit-${unit}`}
              label={unit.toUpperCase()}
              active={unit === unitPreference}
              onPress={() => setUnitPreference(unit as UnitPreference)}
            />
          ))}
        </View>
        <Text style={styles.note}>
          display only — loads are stored and progressed in kg
        </Text>

        {/* Which gym you are in decides what the recommender can offer, so it
            sits with the rest of the gym description rather than costing a
            block of the session picker every time you train. */}
        <Text style={styles.kicker}>MY GYM</Text>
        <View style={styles.chipRow}>
          {gymProfiles.map((profile) => (
            <Chip
              key={profile.id}
              testID={`profile-${profile.id}`}
              label={profile.name.toUpperCase()}
              accessibilityLabel={`Train at ${profile.name}`}
              active={profile.id === activeProfile.id}
              onPress={() => selectGymProfile(profile.id)}
            />
          ))}
        </View>
        <Text style={styles.note}>
          decides which exercises the session screen can offer
        </Text>

        <Chip
          testID="toggle-custom-gym"
          label={customGym.enabled ? 'DIFFERENT GYM: ON' : 'DIFFERENT GYM: OFF'}
          active={customGym.enabled}
          onPress={() => setCustomGym({ ...customGym, enabled: !customGym.enabled })}
        />
        {!customGym.enabled && (
          <Text style={styles.note}>off — one of the stock profiles above applies</Text>
        )}

        {customGym.enabled && (
          <>
            <View style={styles.chipRow}>
              {Object.entries(CUSTOM_GYM_PRESETS).map(([name, equipment]) => (
                <Chip
                  key={name}
                  testID={`preset-${name}`}
                  label={name}
                  active={false}
                  onPress={() => setCustomGym({ enabled: true, equipment })}
                />
              ))}
            </View>
            {EQUIPMENT_TAGS.map((tag) => {
              const has = customGym.equipment.includes(tag);
              return (
                <Pressable
                  key={tag}
                  testID={`equip-${tag}`}
                  onPress={() => toggleEquipment(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: has }}
                  accessibilityLabel={`${tag} available at my gym`}
                  style={(state) => [styles.equipRow, pressFeedback(state)]}
                >
                  <Text style={[styles.equipLabel, has && styles.equipLabelOn]}>
                    {tag.toUpperCase()}
                  </Text>
                  <Text style={[styles.equipState, has && styles.equipLabelOn]}>
                    {has ? '■' : '□'}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        <Text style={styles.kicker}>MY EXERCISES</Text>
        {customExercises.length === 0 && (
          <Text style={styles.note}>
            none yet — customs live on this device; SUBMIT emails one for catalog review
          </Text>
        )}
        {customExercises.map((exercise) => (
          <View key={exercise.id} style={styles.customRow}>
            <View style={styles.customInfo}>
              <Text style={styles.customName}>{exercise.name}</Text>
              <Text style={styles.customMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
            </View>
            <Chip
              testID={`submit-${exercise.id}`}
              label="SUBMIT"
              accessibilityLabel={`Email ${exercise.name} for catalog review`}
              active={false}
              onPress={() => submitExercise(exercise)}
            />
            <Chip
              testID={`delete-${exercise.id}`}
              label={confirmingDeleteId === exercise.id ? 'SURE?' : 'DELETE'}
              accessibilityLabel={
                confirmingDeleteId === exercise.id
                  ? `Confirm deleting ${exercise.name}`
                  : `Delete ${exercise.name}`
              }
              active={confirmingDeleteId === exercise.id}
              onPress={() => onDeleteCustom(exercise.id)}
            />
          </View>
        ))}
        <Chip
          testID="add-custom"
          label="ADD CUSTOM EXERCISE ›"
          active={false}
          onPress={() => router.push('/custom')}
        />

        {/* Splits are BUILT on the session picker, where the need is felt;
            only their removal lives here, with the other config. */}
        <Text style={styles.kicker}>MY SPLITS</Text>
        {customSplits.length === 0 && (
          <Text style={styles.note}>
            none yet — build one from + NEW SPLIT on the training screen
          </Text>
        )}
        {customSplits.map((split) => (
          <View key={split.id} style={styles.customRow}>
            <View style={styles.customInfo}>
              <Text style={styles.customName}>{split.name}</Text>
              <Text style={styles.customMuscles}>{split.muscleGroups.join(' · ')}</Text>
            </View>
            <Chip
              testID={`delete-split-${split.id}`}
              label={confirmingSplitId === split.id ? 'SURE?' : 'DELETE'}
              accessibilityLabel={
                confirmingSplitId === split.id
                  ? `Confirm deleting the ${split.name} split`
                  : `Delete the ${split.name} split`
              }
              active={confirmingSplitId === split.id}
              onPress={() => onDeleteSplit(split.id)}
            />
          </View>
        ))}

        {/* Export only. The demo-history and erase-all buttons were
            prototyping scaffolding and are gone (maintainer call). */}
        <Text style={styles.kicker}>DATA</Text>
        <View style={styles.chipRow}>
          <Chip
            testID="export-data"
            label="EXPORT HISTORY (JSON)"
            active={false}
            onPress={onExport}
          />
        </View>
        {exportStatus && <Text style={styles.note}>{exportStatus}</Text>}

        {/* Data plate — authorship + build provenance (CI stamps the build;
            dev bundles read "dev"). The maker's mark, not marketing. */}
        <View style={styles.dataPlate}>
          {/* Corner fasteners — the one ornament the plate metaphor earns:
              a data plate IS a riveted object. Nowhere else. */}
          <View style={[styles.rivet, styles.rivetTL]} />
          <View style={[styles.rivet, styles.rivetTR]} />
          <View style={[styles.rivet, styles.rivetBL]} />
          <View style={[styles.rivet, styles.rivetBR]} />
          <Text style={styles.plateTitle}>BALLAST</Text>
          <Text style={styles.plateLine}>{ABOUT.tagline}</Text>
          <View style={styles.plateDivider} />
          <Text style={styles.plateLine}>MAKER: {ABOUT.makerName}</Text>
          <Text style={styles.plateLine}>{ABOUT.origin}</Text>
          <Text style={styles.plateLine}>{ABOUT.makerLink}</Text>
          <View style={styles.plateDivider} />
          <Text style={styles.plateLine}>
            REV: {Constants.expoConfig?.version ?? '0.0.0'} · BUILD: {buildInfo.rev}
          </Text>
          <Text style={styles.plateLine}>DTG: {buildInfo.builtAtZulu}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  /** Defaults to the visible label; override where the label is a bare glyph. */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={(state) => [styles.chip, active && styles.chipActive, pressFeedback(state)]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
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
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
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
  chipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  chipLabelActive: {
    color: palette.schematicCyan,
  },
  note: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.secondaryMinPt,
    marginBottom: spacing.sm,
  },
  customInfo: {
    flex: 1,
  },
  customName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  customMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  equipRow: {
    minHeight: touchTarget.secondaryMinPt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surface,
  },
  equipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  equipState: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
  },
  equipLabelOn: {
    color: palette.schematicCyan,
  },
  dataPlate: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.xs,
  },
  plateTitle: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 3,
  },
  plateLine: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  plateDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.slate,
    marginVertical: spacing.xs,
  },
  rivet: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: palette.slate,
    backgroundColor: palette.gunmetal,
  },
  rivetTL: { top: 5, left: 5 },
  rivetTR: { top: 5, right: 5 },
  rivetBL: { bottom: 5, left: 5 },
  rivetBR: { bottom: 5, right: 5 },
});
