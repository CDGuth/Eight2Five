import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/components/gluestack-ui-provider";
import { useEight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { TestbedShell } from "../src/components/TestbedShell";
import { PansManagerProvider } from "../src/pans-manager";
import "../global.css";

SplashScreen.setOptions({
  fade: true,
});
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useEight2FiveFonts();
  const theme = useEight2FiveTheme();

  React.useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <GluestackUIProvider mode="system">
        <SafeAreaProvider>
          <PansManagerProvider>
            <TestbedShell>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.background },
                }}
              />
            </TestbedShell>
          </PansManagerProvider>
          <StatusBar hidden={false} style="light" />
        </SafeAreaProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
