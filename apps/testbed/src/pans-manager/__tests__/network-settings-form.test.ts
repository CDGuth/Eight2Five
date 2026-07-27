import {
  convertNetworkSettingsFormUnits,
  networkSettingsToForm,
  parseNetworkSettingsForm,
} from "../network-settings-form";

const DEFAULT_MANAGED_NETWORK_SETTINGS = {
  mapUnits: "metric" as const,
  mapAreaMode: "infinite" as const,
  coordinateBounds: {
    minXMeters: -1_000,
    maxXMeters: 1_000,
    minYMeters: -1_000,
    maxYMeters: 1_000,
    minZMeters: -100,
    maxZMeters: 100,
  },
  defaultAnchorHeightMeters: 2,
  staleDeviceTimeoutMs: 10_000,
  defaultTagMode: {
    locationEngineEnabled: true,
    lowPowerModeEnabled: false,
    stationaryDetectionEnabled: true,
    locationDataMode: 0 as const,
    movingUpdateRateMs: 100,
    stationaryUpdateRateMs: 1_000,
  },
  autoConnect: false,
  positionLogRetentionDays: 30,
  positionLogMaxSamples: 100_000,
};

describe("network settings form", () => {
  test("round trips all managed network settings and unit conversions", () => {
    const form = networkSettingsToForm(DEFAULT_MANAGED_NETWORK_SETTINGS);
    form.staleDeviceTimeoutSeconds = "12.5";
    form.autoConnect = true;

    expect(parseNetworkSettingsForm(form)).toEqual({
      settings: {
        ...DEFAULT_MANAGED_NETWORK_SETTINGS,
        staleDeviceTimeoutMs: 12_500,
        autoConnect: true,
      },
    });
  });

  test("converts coordinate inputs without changing physical bounds", () => {
    const metric = networkSettingsToForm(DEFAULT_MANAGED_NETWORK_SETTINGS);
    const imperial = convertNetworkSettingsFormUnits(metric, "imperial");
    expect(imperial.mapUnits).toBe("imperial");
    expect(Number(imperial.defaultAnchorHeightMeters)).toBeCloseTo(
      2 / 0.3048,
      5,
    );
    expect(parseNetworkSettingsForm(imperial)).toEqual({
      settings: {
        ...DEFAULT_MANAGED_NETWORK_SETTINGS,
        mapUnits: "imperial",
      },
    });
  });

  test.each([
    ["rejects non-finite values", { minXMeters: "NaN" }, "finite"],
    [
      "rejects reversed bounds",
      { minXMeters: "5", maxXMeters: "4" },
      "minimum",
    ],
    [
      "rejects non-positive time values",
      { staleDeviceTimeoutSeconds: "0" },
      "positive",
    ],
    [
      "rejects anchor height outside Z bounds",
      { defaultAnchorHeightMeters: "101" },
      "Z bounds",
    ],
  ])("%s", (_name, override, expected) => {
    const form = {
      ...networkSettingsToForm(DEFAULT_MANAGED_NETWORK_SETTINGS),
      ...override,
    };
    expect(parseNetworkSettingsForm(form).error).toContain(expected);
  });
});
