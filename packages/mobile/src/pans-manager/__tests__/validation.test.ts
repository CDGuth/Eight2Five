import {
  assertNetworkProfilePanId,
  diffDeviceConfig,
  formatPanId,
  isUniqueName,
  normalizeDeviceConfig,
  parsePanId,
  utf8ByteLength,
} from "../validation";

const tagConfig = {
  role: "tag" as const,
  uwbMode: "active" as const,
  ledEnabled: true,
  firmwareUpdateEnabled: false,
  locationEngineEnabled: true,
  lowPowerModeEnabled: false,
  stationaryDetectionEnabled: true,
  locationDataMode: 0 as const,
};

describe("PANS manager validation", () => {
  test("parses and formats PAN IDs with strict range checks", () => {
    expect(parsePanId("0x00aF")).toBe(0x00af);
    expect(parsePanId("65535")).toBe(0xffff);
    expect(formatPanId(0x2a)).toBe("0x002A");
    expect(() => parsePanId("0x10000")).toThrow("PAN ID");
    expect(() => parsePanId("12junk")).toThrow("PAN ID");
    expect(() => assertNetworkProfilePanId(0)).toThrow("reserved");
    expect(() => assertNetworkProfilePanId(1)).not.toThrow();
  });

  test("checks names case-insensitively and labels by UTF-8 bytes", () => {
    expect(isUniqueName(" FIELD ", ["field"])).toBe(false);
    expect(isUniqueName("FIELD", ["field"], "field")).toBe(true);
    expect(utf8ByteLength("😀😀😀😀")).toBe(16);
    expect(() =>
      normalizeDeviceConfig({ ...tagConfig, label: "😀😀😀😀x" }),
    ).toThrow("16 UTF-8 bytes");
  });

  test("enforces role fields and returns deterministic differences", () => {
    expect(() =>
      normalizeDeviceConfig({
        role: "anchor",
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        locationDataMode: 1,
      } as never),
    ).toThrow("Tag-only");
    expect(
      diffDeviceConfig(
        { ...tagConfig, panId: 1 },
        { ...tagConfig, panId: 2, locationDataMode: 1 },
      ).map((difference) => difference.field),
    ).toEqual(["locationDataMode", "panId"]);
  });
});
