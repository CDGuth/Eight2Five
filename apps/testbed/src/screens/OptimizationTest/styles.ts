import { StyleSheet } from "react-native";
import { testbedPalette, testbedSpacing } from "../../styles/testbed";

export const ACCENT_COLOR = testbedPalette.accent;

export const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: testbedSpacing.lg,
  },
  sectionContent: {
    padding: testbedSpacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: ACCENT_COLOR,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  resultText: {
    fontSize: 13,
    color: testbedPalette.text,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  logBatchContainer: {
    backgroundColor: testbedPalette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: testbedPalette.border,
    marginBottom: testbedSpacing.md,
    overflow: "hidden",
  },
  logBatchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: testbedSpacing.md,
    backgroundColor: testbedPalette.background,
    borderBottomWidth: 1,
    borderBottomColor: testbedPalette.border,
  },
  logBatchTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: testbedPalette.text,
  },
  logBatchTime: {
    fontSize: 11,
    color: testbedPalette.muted,
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  copyButtonText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  logEntries: {
    padding: testbedSpacing.md,
    backgroundColor: testbedPalette.surface,
    maxHeight: 300,
  },
  logText: {
    fontSize: 11,
    marginBottom: 2,
    color: testbedPalette.text,
    fontFamily: "monospace",
  },
  logTimestamp: {
    color: testbedPalette.muted,
  },
  field: {
    backgroundColor: testbedPalette.background,
    position: "relative",
    borderRadius: 8,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
    marginBottom: 8,
  },
  legendText: {
    fontSize: 12,
    color: testbedPalette.muted,
  },
  legendMarkerBase: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#fff",
    marginRight: 6,
  },
});
