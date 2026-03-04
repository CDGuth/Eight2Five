import { StyleSheet } from "react-native";

export const testbedPalette = {
  background: "#f5f7fb",
  surface: "#ffffff",
  accent: "#2d6cdf",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  shadow: "rgba(15, 23, 42, 0.08)",
};

export const testbedSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const testbedStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: testbedPalette.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: testbedSpacing.lg,
    paddingVertical: testbedSpacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: testbedSpacing.md,
    marginTop: testbedSpacing.xs,
  },
  navColumn: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingNav: {
    backgroundColor: testbedPalette.surface,
    padding: 2,
    borderColor: testbedPalette.border,
    borderWidth: 1,
    shadowColor: testbedPalette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  homeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  subBackButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: testbedPalette.border,
  },
  homeButtonIcon: {
    color: testbedPalette.accent,
  },
  titleBlock: {
    flexShrink: 1,
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
  body: {
    flex: 1,
  },
});
