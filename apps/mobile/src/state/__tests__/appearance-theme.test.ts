import {
  eight2FiveDrillColors,
  eight2FiveThemes,
  resolveEight2FiveThemeName,
} from "@eight2five/ui/theme";
import { COLOR_PRESETS } from "@eight2five/drill-schema";

describe("app appearance", () => {
  test("uses the OS appearance only in system mode", () => {
    expect(resolveEight2FiveThemeName("system", "light")).toBe("light");
    expect(resolveEight2FiveThemeName("system", "dark")).toBe("dark");
    expect(resolveEight2FiveThemeName("system", null)).toBe("light");
    expect(resolveEight2FiveThemeName("system", "unspecified")).toBe("light");
  });

  test("light and dark modes override the OS appearance", () => {
    expect(resolveEight2FiveThemeName("light", "dark")).toBe("light");
    expect(resolveEight2FiveThemeName("dark", "light")).toBe("dark");
    expect(eight2FiveThemes.light.background).not.toBe(
      eight2FiveThemes.dark.background,
    );
  });

  test("shares the drill color presets with the UI theme", () => {
    expect(eight2FiveDrillColors).toBe(COLOR_PRESETS);
    expect(eight2FiveThemes.light.accent).toBe(COLOR_PRESETS.blue);
    expect(eight2FiveThemes.dark.accent).toBe(COLOR_PRESETS.blue);
  });
});
