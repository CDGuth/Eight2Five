import { Stack } from "expo-router";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

export default function SettingsLayout() {
  const theme = useEight2FiveTheme();

  return (
    <Stack
      screenOptions={{
        orientation: "portrait",
        headerTintColor: theme.accent,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: {
          color: theme.text,
          fontFamily: eight2FiveFonts.styleSemibold,
        },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="tag" options={{ title: "PANS Tag" }} />
      <Stack.Screen
        name="developer"
        options={{ title: "Developer Settings" }}
      />
      <Stack.Screen
        name="developer-confirmation"
        options={{ title: "Enable Developer Mode" }}
      />
      <Stack.Screen name="anchors" options={{ title: "Cached Anchors" }} />
      <Stack.Screen name="anchor/[anchorId]" options={{ title: "Anchor" }} />
    </Stack>
  );
}
