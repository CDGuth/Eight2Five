import React from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GluestackUIProvider } from "@eight2five/ui/components/gluestack-ui-provider";
import {
  Eight2FiveThemeProvider,
  useEight2FiveFonts,
  useEight2FiveTheme,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

import { TabBarVisibilityProvider } from "../src/navigation/tab-bar-visibility-context";
import { useMobileOrientationLock } from "../src/navigation/use-mobile-orientation-lock";
import {
  AppSettingsProvider,
  useAppSettingsSnapshot,
} from "../src/state/app-settings-store";
import { MobilePansProvider } from "../src/pans/mobile-pans-context";

import "../global.css";

SplashScreen.setOptions({
  fade: true,
});
void SplashScreen.preventAutoHideAsync();

export default function MobileRootLayout() {
  const [fontsLoaded, fontError] = useEight2FiveFonts();

  React.useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          {/* Keep PANS above the UI portal host so modal content retains PANS context. */}
          <MobilePansWithSettings>
            <MobileAppearance>
              <MobileNavigation />
            </MobileAppearance>
          </MobilePansWithSettings>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function MobilePansWithSettings({ children }: { children: React.ReactNode }) {
  const { status, settings } = useAppSettingsSnapshot();
  return (
    <MobilePansProvider
      motionInterpolationEnabled={
        status === "ready" && settings.motionInterpolationEnabled
      }
      developerModeEnabled={status === "ready" && settings.developerModeEnabled}
    >
      {children}
    </MobilePansProvider>
  );
}

function MobileAppearance({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettingsSnapshot();
  return (
    <GluestackUIProvider mode={settings.appearanceMode}>
      <Eight2FiveThemeProvider mode={settings.appearanceMode}>
        {children}
      </Eight2FiveThemeProvider>
    </GluestackUIProvider>
  );
}

function MobileNavigation() {
  useMobileOrientationLock();
  const { settings } = useAppSettingsSnapshot();
  const theme = useEight2FiveTheme();
  const themeName = useEight2FiveThemeName();

  return (
    <ThemeProvider value={themeName === "dark" ? DarkTheme : DefaultTheme}>
      <TabBarVisibilityProvider
        drillFeaturesEnabled={settings.drillFeaturesEnabled}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        />
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      </TabBarVisibilityProvider>
    </ThemeProvider>
  );
}
