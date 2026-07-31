import { deviceFromDiscovery } from "../device-discovery";
import type { ManagedDevice } from "../types";

describe("deviceFromDiscovery", () => {
  test("preserves app and hardware fields while accepting newer concrete transport data", () => {
    const existing: ManagedDevice = {
      id: "saved",
      networkId: "profile",
      transportDeviceId: "transport",
      macAddress: "old-mac",
      nodeIdHex: "00AA",
      nickname: "Local name",
      label: "Hardware label",
      role: "anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 1,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      lastSeenAt: 100,
      notes: "Keep notes",
      createdAt: 10,
      updatedAt: 20,
    };

    const merged = deviceFromDiscovery(
      {
        transportDeviceId: "transport",
        macAddress: "new-mac",
        name: "Advertised Name",
        rssi: -40,
        lastSeenAt: 200,
        compatibility: "compatible",
        presence: {
          rawOperationModeByte: 0,
          rawUwbModeBits: 0,
          role: "tag",
          errorIndicated: false,
          initiator: false,
          bridge: false,
          changeCounter: 0,
        },
      },
      existing,
      { now: 999 },
    );

    expect(merged).toMatchObject({
      id: "saved",
      networkId: "profile",
      macAddress: "new-mac",
      nodeIdHex: "00AA",
      nickname: "Local name",
      label: "Hardware label",
      role: "tag",
      lastSeenAt: 200,
      notes: "Keep notes",
      createdAt: 10,
      updatedAt: 20,
    });
    expect(merged.lastKnownConfig).toEqual(existing.lastKnownConfig);
    expect(merged.label).not.toBe("Advertised Name");
  });

  test("does not replace concrete values with an older or empty discovery", () => {
    const existing: ManagedDevice = {
      id: "saved",
      transportDeviceId: "transport",
      macAddress: "known-mac",
      role: "anchor",
      lastSeenAt: 200,
      createdAt: 10,
      updatedAt: 20,
    };
    const merged = deviceFromDiscovery(
      {
        transportDeviceId: "transport",
        macAddress: " ",
        rssi: -90,
        lastSeenAt: 100,
        compatibility: "unknown",
        presence: {
          rawOperationModeByte: 0,
          rawUwbModeBits: 0,
          role: "tag",
          errorIndicated: false,
          initiator: false,
          bridge: false,
          changeCounter: 0,
        },
      },
      existing,
    );
    expect(merged).toMatchObject({
      macAddress: "known-mac",
      role: "anchor",
      lastSeenAt: 200,
      createdAt: 10,
      updatedAt: 20,
    });
  });
});
