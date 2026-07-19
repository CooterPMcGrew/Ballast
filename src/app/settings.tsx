import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import buildInfo from '@/config/buildInfo.json';
import { CUSTOM_GYM_PRESETS } from '@/domain/equipment';
import {
  EQUIPMENT_TAGS,
  UNIT_PREFERENCES,
  type EquipmentTag,
  type UnitPreference,
} from '@/domain/types';
import { persistence } from '@/persistence';
import { buildExportPayload, exportFileName } from '@/persistence/export';
import { saveExportFile } from '@/persistence/saveExport';
import { useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

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

  const [exportStatus, setExportStatus] = useState<string | null>(null);

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
        <Pressable testID="settings-back" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonLabel}>‹ HOME</Text>
        </Pressable>

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

        <Text style={styles.kicker}>MY GYM</Text>
        <Chip
          testID="toggle-custom-gym"
          label={customGym.enabled ? 'DIFFERENT GYM: ON' : 'DIFFERENT GYM: OFF'}
          active={customGym.enabled}
          onPress={() => setCustomGym({ ...customGym, enabled: !customGym.enabled })}
        />
        {!customGym.enabled && (
          <Text style={styles.note}>off — the stock profiles on Home apply as usual</Text>
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
                  style={styles.equipRow}
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

        <Text style={styles.kicker}>DATA</Text>
        <Chip testID="export-data" label="EXPORT HISTORY (JSON)" active={false} onPress={onExport} />
        {exportStatus && <Text style={styles.note}>{exportStatus}</Text>}

        {/* Data plate — build provenance, stamped by CI (dev = local bundle). */}
        <View style={styles.dataPlate}>
          <Text style={styles.plateTitle}>BALLAST</Text>
          <Text style={styles.plateLine}>AUTO-REGULATING STRENGTH SYSTEM</Text>
          <Text style={styles.plateLine}>MAKER: RAINBOWRUINS</Text>
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
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
});
