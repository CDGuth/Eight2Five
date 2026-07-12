import { PansDeviceSessionManager } from "../PansDeviceSessionManager";
import type { PansNativeGateway } from "../PansDeviceSessionManager";
import { PansDiagnosticsService } from "../PansDiagnosticsService";

jest.mock("expo-pans-ble-api", () => ({}));

const operationMode = {
  role: "tag" as const,
  uwbMode: "active" as const,
  selectedFirmware: 2 as const,
  accelerometerEnabled: true,
  ledEnabled: true,
  firmwareUpdateEnabled: true,
  initiatorEnabled: false,
  lowPowerModeEnabled: false,
  locationEngineEnabled: true,
  raw: [1, 2] as [number, number],
};

function gateway(
  overrides: Partial<PansNativeGateway> = {},
): PansNativeGateway {
  return {
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    readLabel: jest.fn(async () => "field-tag"),
    writeLabel: jest.fn(),
    readNetworkId: jest.fn(async () => 0x1234),
    writeNetworkId: jest.fn(),
    readOperationMode: jest.fn(async () => operationMode),
    patchOperationMode: jest.fn(),
    readLocationDataMode: jest.fn(async () => 2),
    writeLocationDataMode: jest.fn(),
    readTagUpdateRate: jest.fn(async () => ({
      movingUpdateRateMs: 100,
      stationaryUpdateRateMs: 1_000,
      raw: [100, 0, 232, 3],
    })),
    readDeviceInfo: jest.fn(async () => ({
      nodeIdHex: "1234",
      lowNodeId: 0x1234,
      hardwareVersion: 1,
      firmware1Version: 10,
      firmware2Version: 11,
      firmware1Checksum: 12,
      firmware2Checksum: 13,
      operationFlags: 14,
      raw: [1, 2, 3],
    })),
    readAnchorList: jest.fn(async () => ({
      anchors: [{ nodeIdHex: "ABCD", lowNodeId: 0xabcd }],
      raw: [0xab, 0xcd],
      diagnostics: [],
    })),
    readClusterInfo: jest.fn(async () => ({
      seatNumber: 1,
      clusterMap: 2,
      clusterNeighborMap: 3,
      raw: [1, 2, 3],
    })),
    readStatistics: jest.fn(async () => [0x10, 0x20]),
    readAnchorMacStats: jest.fn(async () => [0x30, 0x40]),
    readLocationData: jest.fn(),
    subscribeLocationData: jest.fn(),
    unsubscribeLocationData: jest.fn(),
    addLocationDataListener: jest.fn(() => ({ remove: jest.fn() })),
    decodeLocationData: jest.fn(),
    writePersistedPosition: jest.fn(),
    ...overrides,
  } as PansNativeGateway;
}

describe("PansDiagnosticsService", () => {
  test("captures every supported structured and raw diagnostics section", async () => {
    const native = gateway();
    const service = new PansDiagnosticsService(
      new PansDeviceSessionManager(native),
      () => 123,
    );

    await expect(service.inspect("managed-1", "transport-1")).resolves.toEqual({
      deviceId: "managed-1",
      transportDeviceId: "transport-1",
      capturedAt: 123,
      operationMode,
      label: "field-tag",
      panId: 0x1234,
      locationDataMode: 2,
      updateRate: {
        movingUpdateRateMs: 100,
        stationaryUpdateRateMs: 1_000,
        raw: [100, 0, 232, 3],
      },
      deviceInfo: expect.objectContaining({
        nodeIdHex: "1234",
        raw: [1, 2, 3],
      }),
      clusterInfo: expect.objectContaining({ seatNumber: 1, raw: [1, 2, 3] }),
      anchorList: expect.objectContaining({ raw: [0xab, 0xcd] }),
      statistics: [0x10, 0x20],
      anchorMacStats: [0x30, 0x40],
      warnings: [],
    });
    expect(native.connect).toHaveBeenCalledWith("transport-1", 10_000);
    expect(native.disconnect).toHaveBeenCalledWith("transport-1");
  });

  test("retains successful sections and reports each optional failure", async () => {
    const native = gateway({
      readLabel: jest.fn(async () => {
        throw new Error(
          "CHARACTERISTIC_NOT_FOUND: 3f0afd88-7770-46b0-b5e7-9fc099598964",
        );
      }),
      readDeviceInfo: jest.fn(async () => {
        throw new Error("MALFORMED_PAYLOAD: device info");
      }),
      readStatistics: jest.fn(async () => {
        throw new Error("GATT_ERROR: statistics unavailable");
      }),
    });
    const service = new PansDiagnosticsService(
      new PansDeviceSessionManager(native),
      () => 456,
    );

    const result = await service.inspect("managed-1", "transport-1");

    expect(result.panId).toBe(0x1234);
    expect(result.anchorMacStats).toEqual([0x30, 0x40]);
    expect(result.label).toBeUndefined();
    expect(result.deviceInfo).toBeUndefined();
    expect(result.statistics).toBeUndefined();
    expect(result.warnings).toEqual([
      expect.objectContaining({
        section: "label",
        code: "MISSING_CHARACTERISTIC",
        message: "This optional data is not exposed by the device.",
      }),
      expect.objectContaining({ section: "deviceInfo" }),
      expect.objectContaining({ section: "statistics" }),
    ]);
    expect(JSON.stringify(result.warnings)).not.toContain("3f0afd88");
  });
});
