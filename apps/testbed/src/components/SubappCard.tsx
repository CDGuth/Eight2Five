import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { testbedPalette, testbedSpacing } from "../styles/testbed";

interface SubappCardProps {
  title: string;
  description: string;
  cta?: string;
  badge?: string;
  onPress: () => void;
}

export function SubappCard({
  title,
  description,
  cta = "Open",
  badge,
  onPress,
}: SubappCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.92}
      testID={`subapp-card-${title}`}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>{cta}</Text>
        <MaterialIcons
          name="arrow-forward"
          size={18}
          color={testbedPalette.accent}
          style={styles.ctaArrow}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: testbedPalette.surface,
    borderRadius: 16,
    padding: testbedSpacing.lg,
    marginBottom: testbedSpacing.md,
    borderWidth: 1,
    borderColor: testbedPalette.border,
    shadowColor: testbedPalette.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: testbedSpacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: testbedPalette.text,
    flex: 1,
    marginRight: testbedSpacing.sm,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: testbedPalette.muted,
    marginBottom: testbedSpacing.md,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cta: {
    fontSize: 14,
    fontWeight: "700",
    color: testbedPalette.accent,
    marginRight: testbedSpacing.xs,
  },
  ctaArrow: {
    marginTop: 1,
  },
  badge: {
    backgroundColor: "#ecf2ff",
    paddingHorizontal: testbedSpacing.sm,
    paddingVertical: testbedSpacing.xs,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: testbedPalette.accent,
  },
});
