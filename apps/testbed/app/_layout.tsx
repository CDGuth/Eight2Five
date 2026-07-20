import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/components/gluestack-ui-provider";
import { useEight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

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
    <GluestackUIProvider mode="system">
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        />
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
