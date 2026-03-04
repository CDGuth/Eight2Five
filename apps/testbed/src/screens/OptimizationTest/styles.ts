import { StyleSheet } from "react-native";
import { testbedPalette, testbedSpacing } from "../../styles/testbed";

export const ACCENT_COLOR = testbedPalette.accent;

export const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: testbedPalette.background,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: testbedSpacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: testbedPalette.text,
  },
  section: {
    marginBottom: testbedSpacing.lg,
    backgroundColor: testbedPalette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: testbedPalette.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: testbedSpacing.md,
    backgroundColor: testbedPalette.background,
    borderBottomWidth: 1,
    borderBottomColor: testbedPalette.border,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  sectionContent: {
    padding: testbedSpacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: ACCENT_COLOR,
  },
  collapseIcon: {
    width: 20,
    textAlign: "center",
    color: testbedPalette.muted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  labelContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  labelText: {
    fontSize: 14,
    color: testbedPalette.text,
  },
  controlWrapper: {
    width: 140,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: testbedSpacing.sm,
    fontSize: 14,
    backgroundColor: "#fafafa",
    width: "100%",
    color: testbedPalette.text,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: testbedSpacing.sm,
    backgroundColor: "#fafafa",
    width: "100%",
  },
  dropdownButtonText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownList: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 6,
    marginTop: 4,
  },
  dropdownModalContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdownModalList: {
    position: "absolute",
    zIndex: 2001,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  controls: {
    flexDirection: "row",
    marginVertical: testbedSpacing.lg,
    justifyContent: "center",
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
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    marginTop: 15,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ACCENT_COLOR,
  },
  resultBox: {
    backgroundColor: testbedPalette.surface,
    padding: testbedSpacing.md,
    borderRadius: 8,
    marginBottom: testbedSpacing.lg,
    borderWidth: 1,
    borderColor: testbedPalette.border,
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
  fieldContainer: {
    marginVertical: testbedSpacing.lg,
    backgroundColor: testbedPalette.surface,
    borderRadius: 12,
    padding: testbedSpacing.md,
    borderWidth: 1,
    borderColor: testbedPalette.border,
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxChecked: {
    backgroundColor: ACCENT_COLOR,
  },
});
