import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@eight2five/ui/gluestack-ui-provider";
import {
  eight2FiveFonts,
  useEight2FiveFonts,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SUBAPPS } from "../src/subapps";

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
            headerBackTitle: "Back",
            headerTintColor: theme.accent,
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: {
              color: theme.text,
              fontFamily: eight2FiveFonts.styleSemibold,
            },
            contentStyle: { backgroundColor: theme.background },
          }}
        >
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
              options={{ title: subapp.title, headerShown: false }}
            />
          ))}
        </Stack>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
