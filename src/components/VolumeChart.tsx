import { StyleSheet, Text, View } from 'react-native';

import { HOME_CHART_DAYS } from '@/config/progressionConfig';
import { LB_PER_KG } from '@/domain/units';
import type { UnitPreference } from '@/domain/types';
import { dailyVolumeKg, type VolumeRow } from '@/engine/history';
import { fontFamily, fontSize, palette, spacing } from '@/theme/tokens';

/**
 * Daily volume-load bars (Σ load × reps), trailing HOME_CHART_DAYS.
 * View-based, no chart library — thin cyan bars on a hairline baseline,
 * peak annotated in mono. Volume is shown instead of the MET energy figure
 * because it needs zero assumptions: it is exactly what left the floor.
 */

const CHART_HEIGHT_PX = 72;
/** Rest days keep a visible stub so the timeline stays countable. */
const EMPTY_DAY_STUB_PX = 2;

export function VolumeChart({
  rows,
  unit,
}: {
  rows: readonly VolumeRow[];
  unit: UnitPreference;
}) {
  const totals = dailyVolumeKg(rows, HOME_CHART_DAYS, Date.now());
  const peakKg = Math.max(...totals);

  if (peakKg === 0) {
    return (
      <Text style={styles.emptyNote}>no training in the last {HOME_CHART_DAYS} days</Text>
    );
  }

  const display = (kg: number) =>
    `${Math.round(unit === 'lb' ? kg * LB_PER_KG : kg)} ${unit.toUpperCase()}`;

  return (
    <View>
      <View style={styles.chartRow}>
        {totals.map((kg, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              kg > 0
                ? {
                    height: Math.max(4, (kg / peakKg) * CHART_HEIGHT_PX),
                    backgroundColor: palette.schematicCyan,
                  }
                : { height: EMPTY_DAY_STUB_PX, backgroundColor: palette.slate },
            ]}
          />
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>{HOME_CHART_DAYS}D AGO</Text>
        <Text style={styles.legendText}>PEAK {display(peakKg)}/DAY</Text>
        <Text style={styles.legendText}>TODAY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: CHART_HEIGHT_PX,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate,
    paddingBottom: 0,
  },
  bar: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  legendText: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  emptyNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
});
