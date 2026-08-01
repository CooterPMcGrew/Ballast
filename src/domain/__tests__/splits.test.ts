import { deriveSplitName, focusLabelForGroups } from '@/domain/splits';
import type { CustomSplit } from '@/domain/types';

const BACK_GLUTES: CustomSplit = {
  id: 'split-back-glutes',
  name: 'Back + Glutes',
  muscleGroups: ['back', 'glutes'],
};

describe('deriveSplitName', () => {
  it('joins the picked groups in selection order', () => {
    expect(deriveSplitName(['back', 'glutes'])).toBe('BACK + GLUTES');
    expect(deriveSplitName(['biceps', 'triceps'])).toBe('BICEPS + TRICEPS');
  });

  it('collapses past three groups so a chip label stays glanceable', () => {
    expect(deriveSplitName(['chest', 'back', 'shoulders', 'biceps', 'triceps'])).toBe(
      'CHEST + BACK + SHOULDERS +2',
    );
  });

  it('empty selection has no name', () => {
    expect(deriveSplitName([])).toBe('');
  });
});

describe('focusLabelForGroups', () => {
  it('a stock preset keeps its shipped name', () => {
    expect(focusLabelForGroups(['chest', 'shoulders', 'triceps'], [])).toBe('PUSH');
  });

  it("a user split shows the user's name", () => {
    expect(focusLabelForGroups(['back', 'glutes'], [BACK_GLUTES])).toBe('BACK + GLUTES');
  });

  it('a preset wins over a user split covering the same groups', () => {
    const shadowed: CustomSplit = {
      id: 'split-mine',
      name: 'Chest Day',
      muscleGroups: ['chest', 'shoulders', 'triceps'],
    };
    expect(focusLabelForGroups(['chest', 'shoulders', 'triceps'], [shadowed])).toBe('PUSH');
  });

  it('group order distinguishes splits — it is the label, not a set', () => {
    expect(focusLabelForGroups(['glutes', 'back'], [BACK_GLUTES])).toBe('GLUTES + BACK');
  });

  it('an ad-hoc focus falls through to the derived name', () => {
    expect(focusLabelForGroups(['calves'], [])).toBe('CALVES');
  });
});
