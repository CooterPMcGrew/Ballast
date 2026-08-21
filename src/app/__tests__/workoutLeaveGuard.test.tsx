import { BackHandler } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import WorkoutScreen from '@/app/workout';
import { useAppStore } from '@/store/appStore';

/**
 * An exercise only folds into history on its FINAL set, so leaving after
 * some-but-not-all sets discards them from the progression record. These
 * tests pin the guard that stops that happening on a stray tap — and pin
 * that the guard never stands between the user and the exit when there is
 * nothing to lose.
 */

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args), push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ exerciseId: 'barbell-bench-press' }),
  useFocusEffect: jest.fn(),
}));

// No database in a unit test; the store degrades to in-memory on failure.
jest.mock('@/persistence', () => ({
  persistence: { appendSession: jest.fn().mockResolvedValue(undefined) },
}));

// Captured so the test can fire hardware back exactly as Android would.
let hardwareBackHandler: (() => boolean) | null = null;
jest
  .spyOn(BackHandler, 'addEventListener')
  .mockImplementation((_event, handler) => {
    hardwareBackHandler = handler as () => boolean;
    return {
      remove: () => {
        hardwareBackHandler = null;
      },
    };
  });

/**
 * Trees are unmounted between tests. The store is a module-level singleton,
 * so a tree left mounted stays subscribed and keeps running its effects —
 * a previous test's screen would see activeExercise go null and helpfully
 * rebuild the exercise this test just discarded.
 */
const mounted: TestRenderer.ReactTestRenderer[] = [];

function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<WorkoutScreen />);
  });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  act(() => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
});

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

function exists(tree: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return tree.root.findAllByProps({ testID }).length > 0;
}

describe('workout leave guard', () => {
  beforeEach(() => {
    mockBack.mockClear();
    useAppStore.setState({
      activeExercise: null,
      pausedExercise: null,
      activeSession: {
        muscleGroups: ['chest'],
        completedExerciseIds: [],
        startedAtIso: new Date(0).toISOString(),
        setsCompleted: 0,
        setLog: [],
      },
    });
  });

  it('leaves immediately when no set has been completed', () => {
    const tree = render();

    press(tree, 'screen-back');

    expect(mockBack).toHaveBeenCalled();
    expect(useAppStore.getState().activeExercise).toBeNull();
  });

  it('holds the first back press once a set is on the board', () => {
    const tree = render();
    act(() => {
      useAppStore.getState().completeSet('justRight');
    });

    press(tree, 'screen-back');

    expect(mockBack).not.toHaveBeenCalled();
    expect(useAppStore.getState().activeExercise).not.toBeNull();
    expect(exists(tree, 'confirm-leave')).toBe(true);
  });

  it('KEEP GOING dismisses the warning and keeps the exercise live', () => {
    const tree = render();
    act(() => {
      useAppStore.getState().completeSet('justRight');
    });

    press(tree, 'screen-back');
    press(tree, 'confirm-stay');

    expect(mockBack).not.toHaveBeenCalled();
    expect(exists(tree, 'confirm-leave')).toBe(false);
    expect(useAppStore.getState().activeExercise?.setFeedbacks).toEqual(['justRight']);
  });

  it('DISCARD after the warning abandons the exercise and leaves', () => {
    const tree = render();
    act(() => {
      useAppStore.getState().completeSet('justRight');
    });

    press(tree, 'screen-back');
    press(tree, 'confirm-leave');

    expect(mockBack).toHaveBeenCalled();
    expect(useAppStore.getState().activeExercise).toBeNull();
  });

  it('Android hardware back obeys the same guard rather than popping past it', () => {
    render();
    act(() => {
      useAppStore.getState().completeSet('justRight');
    });

    // Returning true means "handled" — the default pop must not run.
    let handled: boolean | undefined;
    act(() => {
      handled = hardwareBackHandler?.();
    });

    expect(handled).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
    expect(useAppStore.getState().activeExercise).not.toBeNull();
  });
});
