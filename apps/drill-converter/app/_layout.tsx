import React from "react";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: "Eight2Five Drill Converter",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#172033",
      }}
    />
  );
}
