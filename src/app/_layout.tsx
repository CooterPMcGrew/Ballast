import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppStore } from '@/store/appStore';
import { palette } from '@/theme/tokens';

// Keep the native splash up until fonts AND persisted state resolve, so the
// first painted frame is in the design language showing the user's own data —
// no system-font flash, no wrong-profile flash.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrated = useAppStore((state) => state.hydrated);
  const hydrate = useAppStore((state) => state.hydrate);
  const [fontsLoaded, fontError] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    JetBrainsMono_800ExtraBold,
  });

  useEffect(() => {
    // hydrate() resolves even on storage failure (degrades to in-memory),
    // so the splash can never wedge on a broken database.
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontError) {
      // Degraded typography beats a hung splash screen: surface the failure
      // and continue with system fonts rather than blocking app open.
      console.error('Font load failed; falling back to system fonts', fontError);
    }
    if ((fontsLoaded || fontError) && hydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, hydrated]);

  if ((!fontsLoaded && !fontError) || !hydrated) {
    return null; // native splash still covers the screen
  }

  return (
    <>
      {/* Dark-only by design (CLAUDE.md §3) — no light theme exists. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          // Every screen draws its own ScreenHeader instead: one back control
          // with one grammar, rather than a native bar on some routes and a
          // hand-rolled one on others.
          headerShown: false,
          contentStyle: { backgroundColor: palette.gunmetal },
          // A slide carries direction — the user sees they went deeper, and
          // the same motion in reverse tells them they came back out.
          animation: 'slide_from_right',
        }}
      >
        {/*
          The workout screen owns the swipe-back edge. Mid-set, an accidental
          edge swipe would discard the in-flight prescription with no warning
          — precisely the "user cannot aim" failure the app is built against.
          Leaving goes through the labeled control, which confirms first.
        */}
        <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
        {/* Terminal screen: the session it summarizes is already closed, so
            there is nothing behind it to swipe back to. */}
        <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
