import {
  ChakraPetch_400Regular,
  ChakraPetch_600SemiBold,
} from '@expo-google-fonts/chakra-petch';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { palette } from '@/theme/tokens';

// Keep the native splash up until fonts resolve, so the first painted frame
// is already in the design language — no system-font flash.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ChakraPetch_400Regular,
    ChakraPetch_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontError) {
      // Degraded typography beats a hung splash screen: surface the failure
      // and continue with system fonts rather than blocking app open.
      console.error('Font load failed; falling back to system fonts', fontError);
    }
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // native splash still covers the screen
  }

  return (
    <>
      {/* Dark-only by design (CLAUDE.md §3) — no light theme exists. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.gunmetal },
        }}
      />
    </>
  );
}
