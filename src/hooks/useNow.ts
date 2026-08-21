import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * A clock reading that is stable for the life of a render pass and
 * re-stamped whenever the screen regains focus.
 *
 * Why this exists rather than a bare `Date.now()` in the component body:
 * reading the clock during render makes the render impure, and this app
 * builds with React Compiler enabled (app.json → experiments.reactCompiler).
 * The compiler is free to memoize an impure render against a stale reading,
 * which would freeze "4D AGO" and the 7-day recency glow at whatever the
 * clock said when the component first mounted. Re-stamping on focus is also
 * the behavior a user expects: come back to the screen, see current numbers.
 */
export function useNow(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
    }, []),
  );

  return nowMs;
}
