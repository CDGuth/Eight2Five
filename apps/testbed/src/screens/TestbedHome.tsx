import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SubappCard } from "../components/SubappCard";
import { testbedPalette, testbedSpacing } from "../styles/testbed";
import { SUBAPPS, SubappId, TestbedSubapp } from "../subapps";

interface TestbedHomeProps {
  subapps?: TestbedSubapp[];
  onSelect: (id: SubappId) => void;
}

export function TestbedHome({ subapps = SUBAPPS, onSelect }: TestbedHomeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Eight2Five Testbed</Text>
        <Text style={styles.subtitle}>Pick a testing subapp to explore</Text>
      </View>
      <View>
        {subapps.map((entry) => (
          <SubappCard
            key={entry.id}
            title={entry.title}
            description={entry.description}
            badge={entry.badge}
            onPress={() => onSelect(entry.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: testbedSpacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: testbedPalette.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: testbedPalette.muted,
  },
});
