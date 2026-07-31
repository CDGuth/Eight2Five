import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

export default function MobileHomeRoute() {
  const theme = useEight2FiveTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
        backgroundColor: theme.background,
      }}
    >
      <Text
        style={{
          color: theme.text,
          fontFamily: eight2FiveFonts.styleBold,
          fontSize: 24,
        }}
      >
        Eight2Five
      </Text>
      <Text
        style={{
          color: theme.textMuted,
          fontFamily: eight2FiveFonts.utilityRegular,
          fontSize: 16,
          textAlign: "center",
        }}
      >
        Marching band positioning tools
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}
