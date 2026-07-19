import { StyleSheet, View } from 'react-native';

import type { MuscleGroup } from '@/domain/types';
import { palette } from '@/theme/tokens';

/**
 * Schematic body glyph for the muscle-group grid. Thirteen bordered
 * rectangles — a blueprint figure, no SVG dependency, renders identically
 * on web and native. The highlight color carries information (Exposed
 * Mechanism): schematic-cyan = anterior work, copper = posterior chain, so
 * the grid reads as a body map, not decoration.
 */

export interface PartRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Figure canvas in px; parts are laid out absolutely inside it.
 *  Exported with the part/highlight tables so BodyHeatMap shares one body. */
export const GLYPH_WIDTH_PX = 28;
export const GLYPH_HEIGHT_PX = 44;

export const PART_RECTS = {
  head: { x: 10, y: 0, w: 8, h: 6 },
  shoulderL: { x: 2, y: 7, w: 5, h: 4 },
  shoulderR: { x: 21, y: 7, w: 5, h: 4 },
  torsoUpper: { x: 8, y: 7, w: 12, h: 9 },
  torsoMid: { x: 8, y: 16, w: 12, h: 7 },
  hips: { x: 8, y: 23, w: 12, h: 5 },
  armUpperL: { x: 2, y: 12, w: 5, h: 8 },
  armUpperR: { x: 21, y: 12, w: 5, h: 8 },
  armLowerL: { x: 2, y: 21, w: 5, h: 8 },
  armLowerR: { x: 21, y: 21, w: 5, h: 8 },
  legUpperL: { x: 8, y: 29, w: 5, h: 8 },
  legUpperR: { x: 15, y: 29, w: 5, h: 8 },
  legLowerL: { x: 8, y: 38, w: 5, h: 6 },
  legLowerR: { x: 15, y: 38, w: 5, h: 6 },
} satisfies Record<string, PartRect>;

export type PartKey = keyof typeof PART_RECTS;

export interface Highlight {
  parts: PartKey[];
  /** Which side of the body the group lives on — decides highlight color. */
  side: 'anterior' | 'posterior';
}

/**
 * One front-view figure serves both body sides: posterior groups highlight
 * the same silhouette region in copper. Cheaper and clearer than two
 * figures at 28 px.
 */
export const HIGHLIGHT_BY_GROUP: Record<MuscleGroup, Highlight> = {
  chest: { parts: ['torsoUpper'], side: 'anterior' },
  back: { parts: ['torsoUpper'], side: 'posterior' },
  shoulders: { parts: ['shoulderL', 'shoulderR'], side: 'anterior' },
  biceps: { parts: ['armUpperL', 'armUpperR'], side: 'anterior' },
  triceps: { parts: ['armUpperL', 'armUpperR'], side: 'posterior' },
  forearms: { parts: ['armLowerL', 'armLowerR'], side: 'anterior' },
  quads: { parts: ['legUpperL', 'legUpperR'], side: 'anterior' },
  hamstrings: { parts: ['legUpperL', 'legUpperR'], side: 'posterior' },
  glutes: { parts: ['hips'], side: 'posterior' },
  calves: { parts: ['legLowerL', 'legLowerR'], side: 'posterior' },
  core: { parts: ['torsoMid'], side: 'anterior' },
};

export function MuscleMap({ group }: { group: MuscleGroup }) {
  const { parts, side } = HIGHLIGHT_BY_GROUP[group];
  const fill = side === 'anterior' ? palette.schematicCyan : palette.copper;

  return (
    <View style={styles.frame}>
      {(Object.keys(PART_RECTS) as PartKey[]).map((key) => {
        const { x, y, w, h } = PART_RECTS[key];
        const hit = parts.includes(key);
        return (
          <View
            key={key}
            style={[
              styles.part,
              { left: x, top: y, width: w, height: h },
              hit && { backgroundColor: fill, borderColor: fill },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: GLYPH_WIDTH_PX,
    height: GLYPH_HEIGHT_PX,
  },
  part: {
    position: 'absolute',
    borderWidth: 1,
    // Dimmed line work: the figure recedes, the highlighted region reads.
    borderColor: '#8FA0AE55',
  },
});
