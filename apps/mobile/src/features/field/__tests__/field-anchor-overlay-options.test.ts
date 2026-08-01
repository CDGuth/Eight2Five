import { DEFAULT_APP_SETTINGS } from "@eight2five/mobile/settings";

import { fieldAnchorOverlayOptions } from "../field-anchor-overlay-options";

describe("field anchor overlay options", () => {
  test("requires Developer Mode and cached geometry before showing range", () => {
    expect(
      fieldAnchorOverlayOptions({
        ...DEFAULT_APP_SETTINGS,
        showCachedAnchorGeometry: true,
        showComfortableAnchorRange: true,
      }),
    ).toEqual({ visible: false, showRange: false, rangeMeters: 20 });
    expect(
      fieldAnchorOverlayOptions({
        ...DEFAULT_APP_SETTINGS,
        developerModeEnabled: true,
        showCachedAnchorGeometry: false,
        showComfortableAnchorRange: true,
      }),
    ).toEqual({ visible: false, showRange: false, rangeMeters: 20 });
    expect(
      fieldAnchorOverlayOptions({
        ...DEFAULT_APP_SETTINGS,
        developerModeEnabled: true,
        showCachedAnchorGeometry: true,
        showComfortableAnchorRange: true,
        comfortableAnchorRangeMeters: 30,
      }),
    ).toEqual({ visible: true, showRange: true, rangeMeters: 30 });
  });
});
