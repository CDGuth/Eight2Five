import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/gluestack-ui-provider";

import "../global.css";

SplashScreen.setOptions({
  fade: true,
});

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="system">
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerTitleStyle: {
              fontWeight: "700",
            },
            headerBackTitle: "Back",
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: "Eight2Five Testbed",
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="(subapps)/optimization"
            options={{
              title: "Optimization Test",
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
