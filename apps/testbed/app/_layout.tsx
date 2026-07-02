import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/gluestack-ui-provider";

import { SUBAPPS } from "../src/subapps";

import "../global.css";

SplashScreen.setOptions({
  fade: true,
});

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="system">
      <SafeAreaProvider>
        <Stack screenOptions={{ headerBackTitle: "Back" }}>
          <Stack.Screen
            name="index"
            options={{
              title: "Eight2Five Testbed",
              headerBackVisible: false,
            }}
          />
          {SUBAPPS.map((subapp) => (
            <Stack.Screen
              key={subapp.id}
              name={subapp.routeName}
              options={{ title: subapp.title }}
            />
          ))}
        </Stack>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
