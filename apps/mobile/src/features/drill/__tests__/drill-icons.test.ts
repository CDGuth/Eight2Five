import {
  DRILL_ICON_REGISTRY,
  FALLBACK_DRILL_ICON,
  isSupportedDrillIcon,
  resolveDrillIcon,
} from "../drill-icons";

describe("drill card icon registry", () => {
  test("resolves only controlled icon names and falls back for unknown names", () => {
    expect(resolveDrillIcon("music-2")).toBe(DRILL_ICON_REGISTRY["music-2"]);
    expect(resolveDrillIcon("made-up-icon")).toBe(FALLBACK_DRILL_ICON);
    expect(resolveDrillIcon(undefined)).toBe(FALLBACK_DRILL_ICON);
    expect(isSupportedDrillIcon("sparkle")).toBe(true);
    expect(isSupportedDrillIcon("sparkles")).toBe(true);
    expect(isSupportedDrillIcon("made-up-icon")).toBe(false);
  });
});
