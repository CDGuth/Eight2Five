import React from "react";
import { Stack } from "expo-router";

export default function Dwm1001ManagerLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
