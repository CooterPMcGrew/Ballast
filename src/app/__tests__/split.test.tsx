import TestRenderer, { act } from 'react-test-renderer';

import SplitBuilderScreen from '@/app/split';
import { useAppStore } from '@/store/appStore';

// The screen navigates back on save; routing itself is not under test.
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

// No database in a unit test. Stubbing the write-through also lets the test
// assert that saving a split actually reaches storage, not just the store.
const mockSaveCustomSplits = jest.fn().mockResolvedValue(undefined);
jest.mock('@/persistence', () => ({
  persistence: { saveCustomSplits: (...args: unknown[]) => mockSaveCustomSplits(...args) },
}));

/** React 19 requires the initial mount inside act() as well as updates. */
function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<SplitBuilderScreen />);
  });
  return tree;
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

describe('split builder', () => {
  beforeEach(() => {
    useAppStore.setState({ customSplits: [] });
    mockSaveCustomSplits.mockClear();
  });

  it('picking muscles and saving produces a split the picker can use', () => {
    const tree = render();

    press(tree, 'split-muscle-back');
    press(tree, 'split-muscle-glutes');
    press(tree, 'split-save');

    const [split] = useAppStore.getState().customSplits;
    expect(split?.muscleGroups).toEqual(['back', 'glutes']);
    // No name typed: derived from the selection, in selection order.
    expect(split?.name).toBe('BACK + GLUTES');
    // And it survives a restart, not just this session.
    expect(mockSaveCustomSplits).toHaveBeenCalledWith([split]);
  });

  it('a second tap removes a muscle', () => {
    const tree = render();

    press(tree, 'split-muscle-biceps');
    press(tree, 'split-muscle-triceps');
    press(tree, 'split-muscle-biceps');
    press(tree, 'split-save');

    expect(useAppStore.getState().customSplits[0]?.muscleGroups).toEqual(['triceps']);
  });

  it('saving with nothing picked is a no-op, not an empty split', () => {
    const tree = render();

    press(tree, 'split-save');

    expect(useAppStore.getState().customSplits).toHaveLength(0);
    expect(mockSaveCustomSplits).not.toHaveBeenCalled();
  });
});
