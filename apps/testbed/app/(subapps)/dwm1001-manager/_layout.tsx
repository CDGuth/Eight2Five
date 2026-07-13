import React from "react";
import { Stack } from "expo-router";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { PansManagerProvider } from "../../../src/subapps/dwm1001-manager";

export default function Dwm1001ManagerLayout() {
  const theme = useEight2FiveTheme();

  return (
    <PansManagerProvider>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerBackButtonDisplayMode: "minimal",
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
          options={{ title: "DWM1001-DEV Network Manager" }}
        />
        <Stack.Screen
          name="discovery"
          options={{ title: "Discover Devices" }}
        />
        <Stack.Screen
          name="networks/new"
          options={{ title: "Create Network" }}
        />
        <Stack.Screen
          name="networks/[networkId]/index"
          options={{ title: "Network" }}
        />
        <Stack.Screen
          name="networks/[networkId]/devices"
          options={{ title: "Network Devices" }}
        />
        <Stack.Screen
          name="networks/[networkId]/settings"
          options={{ title: "Network Settings" }}
        />
        <Stack.Screen
          name="networks/[networkId]/batch-configure"
          options={{ title: "Batch Configure" }}
        />
        <Stack.Screen
          name="networks/[networkId]/grid"
          options={{ title: "Position & Track" }}
        />
        <Stack.Screen
          name="networks/[networkId]/topology"
          options={{ title: "Observed Topology" }}
        />
        <Stack.Screen
          name="networks/[networkId]/log"
          options={{ title: "Position Logs" }}
        />
        <Stack.Screen
          name="devices/[deviceId]/index"
          options={{ title: "Device" }}
        />
        <Stack.Screen
          name="devices/[deviceId]/edit"
          options={{ title: "Edit Device" }}
        />
        <Stack.Screen
          name="devices/[deviceId]/diagnostics"
          options={{ title: "Diagnostics" }}
        />
        <Stack.Screen
          name="devices/[deviceId]/firmware"
          options={{ title: "Firmware Update Disabled" }}
        />
        <Stack.Screen name="settings" options={{ title: "Manager Settings" }} />
        <Stack.Screen name="import" options={{ title: "Import Profile" }} />
      </Stack>
    </PansManagerProvider>
  );
}
