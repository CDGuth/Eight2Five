import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/components/gluestack-ui-provider";
import { useEight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { TabBarVisibilityProvider } from "../src/navigation/tab-bar-visibility-context";
import {
  AppSettingsProvider,
  useAppSettingsSnapshot,
} from "../src/state/app-settings-store";

import "../global.css";

SplashScreen.setOptions({
  fade: true,
});
void SplashScreen.preventAutoHideAsync();

export default function MobileRootLayout() {
  const [fontsLoaded, fontError] = useEight2FiveFonts();
  const theme = useEight2FiveTheme();

  React.useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GluestackUIProvider mode="system">
      <SafeAreaProvider>
        <AppSettingsProvider>
          <MobileNavigation backgroundColor={theme.background} />
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}

function MobileNavigation({ backgroundColor }: { backgroundColor: string }) {
  const { settings } = useAppSettingsSnapshot();

  return (
    <TabBarVisibilityProvider
      drillFeaturesEnabled={settings.drillFeaturesEnabled}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor },
        }}
      />
      <StatusBar style="auto" />
    </TabBarVisibilityProvider>
  );
}
