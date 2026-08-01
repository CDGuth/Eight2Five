import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  normalizeManagedNetworkSettings,
  normalizePansManagerSettings,
} from "../types";

describe("PANS manager settings compatibility", () => {
  test("drops obsolete global and network scan durations", () => {
    const manager = normalizePansManagerSettings({
      discoveryStaleAfterMs: 5_000,
      discoveryScanDurationMs: 25_000,
    } as never);
    const network = normalizeManagedNetworkSettings({
      ...DEFAULT_MANAGED_NETWORK_SETTINGS,
      scanDurationMs: 15_000,
    } as never);

    expect(manager.discoveryStaleAfterMs).toBe(5_000);
    expect(manager).not.toHaveProperty("discoveryScanDurationMs");
    expect(network).not.toHaveProperty("scanDurationMs");
  });

  test("preserves only a non-empty remembered tag identity", () => {
    expect(
      normalizePansManagerSettings({ rememberedTagDeviceId: "tag-1" }),
    ).toMatchObject({ rememberedTagDeviceId: "tag-1" });
    expect(
      normalizePansManagerSettings({ rememberedTagDeviceId: "" }),
    ).not.toHaveProperty("rememberedTagDeviceId");
  });

  test("defaults and validates map display settings for older records", () => {
    expect(
      normalizeManagedNetworkSettings({
        ...DEFAULT_MANAGED_NETWORK_SETTINGS,
        mapUnits: undefined,
        mapAreaMode: undefined,
      } as never),
    ).toMatchObject({ mapUnits: "metric", mapAreaMode: "infinite" });
    expect(
      normalizeManagedNetworkSettings({
        ...DEFAULT_MANAGED_NETWORK_SETTINGS,
        mapUnits: "invalid",
        mapAreaMode: "invalid",
      } as never),
    ).toMatchObject({ mapUnits: "metric", mapAreaMode: "infinite" });
  });
});
