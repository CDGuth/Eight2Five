import React from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.setOptions({
  fade: true,
});

export default function MobileRootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Eight2Five",
        }}
      />
    </Stack>
  );
}
