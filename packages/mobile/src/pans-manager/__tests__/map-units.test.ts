import {
  convertMapInputText,
  formatMapDistance,
  mapUnitsToMeters,
  metersToMapUnits,
} from "../map-units";

describe("PANS map units", () => {
  test("converts only at display and input boundaries", () => {
    expect(metersToMapUnits(0.3048, "imperial")).toBeCloseTo(1);
    expect(mapUnitsToMeters(1, "imperial")).toBeCloseTo(0.3048);
    expect(convertMapInputText("1", "metric", "imperial")).toBe("3.28084");
    expect(convertMapInputText("3.28084", "imperial", "metric")).toBe("1");
  });

  test("preserves incomplete or invalid input while formatting finite distances", () => {
    expect(convertMapInputText("-", "metric", "imperial")).toBe("-");
    expect(convertMapInputText("", "metric", "imperial")).toBe("");
    expect(formatMapDistance(1, "metric")).toBe("1 m");
    expect(formatMapDistance(0.3048, "imperial")).toBe("1 ft");
  });
});
