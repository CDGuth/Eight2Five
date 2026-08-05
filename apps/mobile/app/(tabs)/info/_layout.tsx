import { Stack } from "expo-router";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

export default function InfoLayout() {
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
      <Stack.Screen name="index" options={{ title: "Info" }} />
    </Stack>
  );
}
