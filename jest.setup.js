// Reanimated's real entry point installs native worklet bindings that do not
// exist under Jest, so importing any screen that animates throws before a
// single assertion runs. Reanimated 4 ships a mock, but it is not
// self-contained — it re-enters the same native initializer — so this is a
// hand-rolled stand-in covering exactly the surface this app uses.
//
// Animations resolve straight to their final value, which is the state a
// test wants to assert against: motion here only makes a state change
// legible, it never gates behavior.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');

  /**
   * Entering/layout animations are chainable builders in the real API
   * (`FadeIn.duration(180)`). Tests only need the chain to keep resolving to
   * something a prop can hold.
   */
  const animationBuilder = () => {
    const stub = {};
    for (const method of [
      'duration',
      'delay',
      'easing',
      'springify',
      'damping',
      'stiffness',
      'withInitialValues',
      'withCallback',
      'reduceMotion',
      'randomDelay',
      'build',
    ]) {
      stub[method] = () => stub;
    }
    return stub;
  };

  const Animated = { View, Text: require('react-native').Text };

  return {
    __esModule: true,
    default: Animated,
    View,
    FadeIn: animationBuilder(),
    FadeOut: animationBuilder(),
    LinearTransition: animationBuilder(),
    Easing: {
      linear: (t) => t,
      ease: (t) => t,
      inOut: (fn) => fn,
      out: (fn) => fn,
      in: (fn) => fn,
    },
    useSharedValue: (initial) => ({ value: initial }),
    // The real hook re-evaluates on the UI thread; calling it once gives the
    // resolved style, which is all a render assertion needs.
    useAnimatedStyle: (factory) => factory(),
    withTiming: (toValue) => toValue,
    withSpring: (toValue) => toValue,
    cancelAnimation: () => undefined,
  };
});
