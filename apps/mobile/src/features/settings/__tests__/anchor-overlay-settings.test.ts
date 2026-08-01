import { DEFAULT_APP_SETTINGS } from "@eight2five/mobile/settings";

import { parseComfortableAnchorRange } from "../comfortable-anchor-range";

describe("anchor overlay settings", () => {
  test("uses the planning default and accepts a finite bounded range", () => {
    expect(DEFAULT_APP_SETTINGS.comfortableAnchorRangeMeters).toBe(20);
    expect(parseComfortableAnchorRange("20.0")).toEqual({ value: 20 });
    expect(parseComfortableAnchorRange("0")).toHaveProperty("error");
    expect(parseComfortableAnchorRange("Infinity")).toHaveProperty("error");
    expect(parseComfortableAnchorRange("200.1")).toHaveProperty("error");
  });
});
