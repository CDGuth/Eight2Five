import { Stack } from "expo-router";

export default function FieldLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        orientation: "all",
      }}
    />
  );
}
