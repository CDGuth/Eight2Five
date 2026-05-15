import React from "react";
import { Stack } from "expo-router";

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
