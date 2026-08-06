import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";

import { resolveEffectiveFieldPreset } from "../effective-field-preset";

const PRESETS = FIELD_PRESET_IDS;

describe("effective marching field selection", () => {
  test.each(PRESETS)(
    "uses %s as the preference when no drill is loaded",
    (preset) => {
      expect(resolveEffectiveFieldPreset(undefined, preset)).toBe(preset);
    },
  );

  test.each([
    ["football-nfhs", "football-ncaa"],
    ["football-ncaa", "football-nfhs"],
    ["football-texas-uil", "football-ncaa"],
    ["football-nfl", "football-nfhs"],
  ] as const)(
    "loaded %s drill overrides %s preference",
    (drillPreset, defaultPreset) => {
      expect(
        resolveEffectiveFieldPreset(
          { fieldPreset: drillPreset },
          defaultPreset,
        ),
      ).toBe(drillPreset);
    },
  );
});
