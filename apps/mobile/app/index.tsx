import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function MobileHomeRoute() {
  return (
    <View style={styles.container}>
      <Text>Eight2Five</Text>
      <Text style={styles.subtitle}>
        Expo Router is now configured for this app.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  subtitle: {
    color: "#555",
  },
});
