import { Redirect, Stack } from "expo-router";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useAppSettingsSnapshot } from "../../../src/state/app-settings-store";
import { getDrillRouteAccess } from "../../../src/features/drill/drill-route-access";

export default function DrillLayout() {
  const theme = useEight2FiveTheme();
  const { status, settings } = useAppSettingsSnapshot();
  const access = getDrillRouteAccess(status, settings.drillFeaturesEnabled);

  // Keep disabled drill routes inaccessible even when opened from a stale link.
  if (access === "loading") return null;
  if (access === "redirect") {
    return <Redirect href="/(tabs)/field" />;
  }

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
      <Stack.Screen name="index" options={{ title: "Drill" }} />
      <Stack.Screen name="new" options={{ title: "Create Drill" }} />
      <Stack.Screen name="[drillId]/index" options={{ title: "Drill" }} />
      <Stack.Screen
        name="[drillId]/page/[pageId]"
        options={{ title: "Drill Entry" }}
      />
    </Stack>
  );
}
