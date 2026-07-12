import React from "react";
import { Stack } from "expo-router";

import { PansManagerProvider } from "../../../src/subapps/dwm1001-manager";

export default function Dwm1001ManagerLayout() {
  return (
    <PansManagerProvider>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: "#3c6ec8",
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "DWM1001 Manager" }} />
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
          options={{ title: "Network Grid" }}
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
