import { StyleSheet, Text, View } from 'react-native';

import {
  GLYPH_HEIGHT_PX,
  GLYPH_WIDTH_PX,
  HIGHLIGHT_BY_GROUP,
  PART_RECTS,
  type PartKey,
} from '@/components/MuscleMap';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
import { fontFamily, fontSize, palette, spacing } from '@/theme/tokens';

/**
 * Whole-body status: two figures (front / back) whose regions glow with a
 * 0–1 intensity per muscle group — session coverage on the session page,
 * 7-day recency on Home. Brightness IS the datum (Exposed Mechanism): a
 * muscle at zero sits gray, at 1 it reaches the full accent color. Same
 * color language as the grid glyphs — cyan anterior, copper posterior.
 */

/** RGB triplets of palette.schematicCyan / palette.copper for rgba() alpha. */
const ANTERIOR_RGB = '40, 200, 214';
const POSTERIOR_RGB = '207, 138, 78';

/** Below this intensity a region reads as noise on OLED — clamp to zero. */
const GLOW_VISIBILITY_FLOOR = 0.04;

interface BodyHeatMapProps {
  intensityByGroup: Partial<Record<MuscleGroup, number>>;
  /** Multiplies the 28×44 base figure; 2 ≈ Home hero, 1.5 ≈ session inset. */
  scale?: number;
}

export function BodyHeatMap({ intensityByGroup, scale = 2 }: BodyHeatMapProps) {
  return (
    <View style={styles.row}>
      <Figure side="anterior" label="FRONT" intensityByGroup={intensityByGroup} scale={scale} />
      <Figure side="posterior" label="BACK" intensityByGroup={intensityByGroup} scale={scale} />
    </View>
  );
}

function Figure({
  side,
  label,
  intensityByGroup,
  scale,
}: {
  side: 'anterior' | 'posterior';
  label: string;
  intensityByGroup: Partial<Record<MuscleGroup, number>>;
  scale: number;
}) {
  // Which part glows at what intensity on this side of the body.
  const glowByPart = new Map<PartKey, number>();
  for (const group of MUSCLE_GROUPS) {
    const highlight = HIGHLIGHT_BY_GROUP[group];
    if (highlight.side !== side) continue;
    const intensity = Math.min(1, intensityByGroup[group] ?? 0);
    if (intensity < GLOW_VISIBILITY_FLOOR) continue;
    for (const part of highlight.parts) {
      glowByPart.set(part, Math.max(glowByPart.get(part) ?? 0, intensity));
    }
  }
  const rgb = side === 'anterior' ? ANTERIOR_RGB : POSTERIOR_RGB;

  return (
    <View style={styles.figure}>
      <View style={{ width: GLYPH_WIDTH_PX * scale, height: GLYPH_HEIGHT_PX * scale }}>
        {(Object.keys(PART_RECTS) as PartKey[]).map((key) => {
          const { x, y, w, h } = PART_RECTS[key];
          const glow = glowByPart.get(key);
          return (
            <View
              key={key}
              style={[
                styles.part,
                {
                  left: x * scale,
                  top: y * scale,
                  width: w * scale,
                  height: h * scale,
                },
                glow !== undefined && { backgroundColor: `rgba(${rgb}, ${glow})` },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  figure: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  part: {
    position: 'absolute',
    borderWidth: 1,
    // Untrained ground state: gray line work, no fill.
    borderColor: '#8FA0AE55',
  },
  label: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
  },
});
