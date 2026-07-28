import {
  ANCHOR_POSITION_QUALITY,
  EXPORT_FORMAT_CHOICES,
  LOCATION_DATA_MODE_CHOICES,
  MAP_AREA_MODE_CHOICES,
  MAP_UNIT_CHOICES,
  anchorCoordinateError,
  anchorQualityError,
  formatPanInput,
  parseAnchorCoordinate,
  parseAnchorQuality,
  parsePanInput,
} from "../settings-definitions";

jest.mock("expo-pans-ble-api", () => ({}));

describe("canonical settings definitions", () => {
  test("exposes readonly choices in canonical display order", () => {
    expect(MAP_UNIT_CHOICES.map(({ value }) => value)).toEqual([
      "metric",
      "imperial",
    ]);
    expect(MAP_AREA_MODE_CHOICES.map(({ value }) => value)).toEqual([
      "infinite",
      "bounded",
    ]);
    expect(LOCATION_DATA_MODE_CHOICES.map(({ value }) => value)).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(EXPORT_FORMAT_CHOICES.map(({ value }) => value)).toEqual([
      "json",
      "csv",
    ]);
  });

  test("uses the shared PAN parser and formatter", () => {
    expect(parsePanInput("2A")).toBe(0x2a);
    expect(formatPanInput(0x2a)).toBe("0x002A");
    expect(parsePanInput("not-a-pan")).toBeUndefined();
  });

  test("uses one anchor coordinate and quality contract", () => {
    expect(parseAnchorCoordinate("3.280839895", "imperial")).toBeCloseTo(1);
    expect(anchorCoordinateError("Infinity")).toBe(
      "Enter a finite coordinate.",
    );
    expect(parseAnchorQuality("")).toBe(ANCHOR_POSITION_QUALITY.default);
    expect(parseAnchorQuality("101")).toBeUndefined();
    expect(anchorQualityError("0")).toMatch("1 to 100");
  });
});
