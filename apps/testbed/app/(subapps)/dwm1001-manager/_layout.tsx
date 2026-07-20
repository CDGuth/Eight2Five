import React from "react";
import { Stack } from "expo-router";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import { PansManagerProvider } from "../../../src/subapps/dwm1001-manager";

export default function Dwm1001ManagerLayout() {
  const theme = useEight2FiveTheme();

  return (
    <PansManagerProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </PansManagerProvider>
  );
}
