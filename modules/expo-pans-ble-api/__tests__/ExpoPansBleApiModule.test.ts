import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addCharacteristicNotificationListener,
  addDeviceDiscoveredListener,
  clearDevices,
  connect,
  decodeAnchorList,
  decodeClusterInfo,
  decodeDeviceInfo,
  decodeFirmwareUpdatePoll,
  decodeLocationData,
  decodeOperationMode,
  decodePresenceData,
  decodeProxyPositions,
  decodeTagUpdateRate,
  disconnect,
  encodeFirmwareUpdateChunk,
  encodeFirmwareUpdateOffer,
  encodeOperationMode,
  encodePersistedPosition,
  getCapabilities,
  getScanDiagnostics,
  patchOperationMode,
  prepareFirmwareUpdateTransport,
  readAnchorList,
  readAnchorMacStats,
  readClusterInfo,
  readDeviceInfo,
  readLabel,
  readLocationData,
  readOperationMode,
  readProxyPositions,
  readStatistics,
  readTagUpdateRate,
  requestMtu,
  requestExplicitDisconnect,
  startScanning,
  subscribeFirmwareUpdatePoll,
  stopScanning,
  subscribeLocationData,
  writeFirmwareUpdateChunk,
  writeFirmwareUpdateOffer,
  writeCharacteristic,
  writeLabel,
  writeLocationDataMode,
  writeNetworkId,
  writeOperationMode,
} from "../src/ExpoPansBleApiModule";
import {
  ExpoPansBleApiModuleEvents,
  PANS_BLE_UUIDS,
} from "../src/ExpoPansBleApi.types";
import type { PansBleCapabilities } from "../src/ExpoPansBleApi.types";
import {
  clonePansLocationDataFixture,
  PANS_LOCATION_DATA_FIXTURES,
  pansBytesToHex,
} from "../src/testing/PansLocationDataFixtures";

type NativeModuleMock = {
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  clearDevices: jest.Mock;
  getCapabilities: jest.Mock;
  getPermissionStatus: jest.Mock;
  getScanDiagnostics: jest.Mock;
  requestPermissions: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  readCharacteristic: jest.Mock;
  writeCharacteristic: jest.Mock;
  setCharacteristicNotifications: jest.Mock;
  requestMtu: jest.Mock;
  getMaximumWriteValueLength: jest.Mock;
};

let mockCapabilities: PansBleCapabilities = {
  transport: "ble",
  supportsScanning: true,
  supportsConnection: true,
  supportsNotifications: true,
  supportsMtuRequest: true,
  supportsMaximumWriteValueLength: false,
};

jest.mock("expo-modules-core", () => {
  const mockSubscription = { remove: jest.fn() };
  const mockAddListener = jest.fn().mockReturnValue(mockSubscription);
  const mockNativeModule: NativeModuleMock = {
    startScanning: jest.fn(async () => undefined),
    stopScanning: jest.fn(),
    clearDevices: jest.fn(),
    getCapabilities: jest.fn(() => mockCapabilities),
    getPermissionStatus: jest.fn(() => ({ bluetooth: "granted" })),
    getScanDiagnostics: jest.fn(() => ({
      state: "scanning",
      buildId: "test-build",
      scanSessionId: 1,
      rawResultCount: 2,
      pansResultCount: 1,
      parsedServiceDataHitCount: 0,
      rawAdvertisementHitCount: 1,
      rejectedResultCount: 1,
    })),
    requestPermissions: jest.fn(async () => ({ bluetooth: "granted" })),
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    readCharacteristic: jest.fn(async () => []),
    writeCharacteristic: jest.fn(async () => true),
    setCharacteristicNotifications: jest.fn(async () => true),
    requestMtu: jest.fn(async (_deviceId, mtu: number) => mtu),
    getMaximumWriteValueLength: jest.fn(async () => 64),
  };

  return {
    EventEmitter: jest.fn().mockImplementation(() => ({
      addListener: mockAddListener,
    })),
    requireNativeModule: jest.fn(() => mockNativeModule),
    __mocks: { mockAddListener, mockSubscription, mockNativeModule },
  };
});

const {
  __mocks: { mockAddListener, mockSubscription, mockNativeModule },
} = jest.requireMock("expo-modules-core") as {
  __mocks: {
    mockAddListener: jest.Mock;
    mockSubscription: { remove: jest.Mock };
    mockNativeModule: NativeModuleMock;
  };
};

function resetMocks(): void {
  jest.clearAllMocks();
  Object.values(mockNativeModule).forEach((mockFn) => mockFn.mockClear());
  mockAddListener.mockReturnValue(mockSubscription);
  mockNativeModule.connect.mockResolvedValue(true);
  mockNativeModule.disconnect.mockResolvedValue(true);
  mockNativeModule.readCharacteristic.mockResolvedValue([]);
  mockNativeModule.writeCharacteristic.mockResolvedValue(true);
  mockNativeModule.setCharacteristicNotifications.mockResolvedValue(true);
  mockNativeModule.requestMtu.mockResolvedValue(64);
  mockNativeModule.getMaximumWriteValueLength.mockResolvedValue(64);
  mockCapabilities = {
    transport: "ble",
    supportsScanning: true,
    supportsConnection: true,
    supportsNotifications: true,
    supportsMtuRequest: true,
    supportsMaximumWriteValueLength: false,
  };
}

describe("PANS BLE codecs", () => {
  test("decodes and re-encodes tag active location-engine operation mode", () => {
    const mode = decodeOperationMode([0x40, 0x20]);
    expect(mode).toMatchObject({
      role: "tag",
      uwbMode: "active",
      selectedFirmware: 1,
      locationEngineEnabled: true,
    });
    expect(encodeOperationMode(mode)).toEqual([0x40, 0x20]);
  });

  test("decodes anchor active initiator operation mode", () => {
    const mode = decodeOperationMode([0xc0, 0x80]);
    expect(mode.role).toBe("anchor");
    expect(mode.uwbMode).toBe("active");
    expect(mode.initiatorEnabled).toBe(true);
  });

  test("preserves reserved operation-mode bits", () => {
    const mode = decodeOperationMode([0x01, 0x1f]);
    expect(encodeOperationMode({ ...mode, ledEnabled: true })).toEqual([
      0x05, 0x1f,
    ]);
  });

  test("rejects malformed operation-mode UWB bits", () => {
    expect(() => decodeOperationMode([0x60, 0])).toThrow("UWB mode bits");
  });

  test("rejects invalid operation-mode length", () => {
    expect(() => decodeOperationMode([1])).toThrow("operation mode");
  });

  test("encodes persisted position in millimeters", () => {
    const encoded = encodePersistedPosition({
      xMeters: 1.5,
      yMeters: -2.25,
      zMeters: 0.75,
      quality: 80,
    });
    expect(encoded).toHaveLength(13);
    expect(encoded.slice(0, 4)).toEqual([0xdc, 0x05, 0x00, 0x00]);
    expect(encoded[12]).toBe(80);
  });

  test("encodes persisted position signed-int32 millimeter boundaries", () => {
    const encoded = encodePersistedPosition({
      xMeters: 2_147_483.647,
      yMeters: -2_147_483.648,
      zMeters: 0,
      quality: 100,
    });

    expect(encoded.slice(0, 4)).toEqual([0xff, 0xff, 0xff, 0x7f]);
    expect(encoded.slice(4, 8)).toEqual([0x00, 0x00, 0x00, 0x80]);
  });

  test("rejects persisted position non-finite and out-of-range values", () => {
    expect(() =>
      encodePersistedPosition({ xMeters: Number.NaN, yMeters: 0 }),
    ).toThrow("finite numbers");
    expect(() =>
      encodePersistedPosition({
        xMeters: Number.POSITIVE_INFINITY,
        yMeters: 0,
      }),
    ).toThrow("finite numbers");
    expect(() =>
      encodePersistedPosition({
        xMeters: Number.NEGATIVE_INFINITY,
        yMeters: 0,
      }),
    ).toThrow("finite numbers");
    expect(() =>
      encodePersistedPosition({ xMeters: 2_147_483.648, yMeters: 0 }),
    ).toThrow("signed int32");
    expect(() =>
      encodePersistedPosition({ xMeters: 0, yMeters: -2_147_483.649 }),
    ).toThrow("signed int32");
    expect(() =>
      encodePersistedPosition({
        xMeters: 0,
        yMeters: 0,
        quality: Number.NaN,
      }),
    ).toThrow("quality must be a finite number");
    expect(() =>
      encodePersistedPosition({ xMeters: 0, yMeters: 0, quality: 101 }),
    ).toThrow("quality");
  });

  test("decodes empty, position, distances, and combined location frames", () => {
    expect(decodeLocationData(clonePansLocationDataFixture("empty"))).toEqual({
      distances: [],
      raw: [],
      diagnostics: [],
    });

    const positionOnly = decodeLocationData(
      clonePansLocationDataFixture("positionOnly14"),
    );
    expect(positionOnly.position).toMatchObject({
      xMeters: 1,
      yMeters: -2,
      zMeters: 3,
      quality: 77,
    });

    const distanceOnly = decodeLocationData(
      clonePansLocationDataFixture("distanceOnlyOneAnchor"),
    );
    expect(distanceOnly.distances[0]).toMatchObject({
      nodeId: 0x1234,
      distanceMeters: 1,
      quality: 90,
    });

    const combined = decodeLocationData(
      clonePansLocationDataFixture("combinedPositionAndDistance"),
    );
    expect(combined.position?.zMeters).toBe(0.03);
    expect(combined.distances[0].nodeId).toBe(0x5678);
  });

  test("decodes type-2 distance-only fallback with multiple anchors", () => {
    const decoded = decodeLocationData(
      clonePansLocationDataFixture("type2DistanceOnlyFallback"),
    );

    expect(decoded.position).toBeUndefined();
    expect(decoded.distances).toEqual([
      expect.objectContaining({ nodeId: 1, distanceMeters: 1 }),
      expect.objectContaining({ nodeId: 2, distanceMeters: 2 }),
    ]);
  });

  test("reports malformed location diagnostics", () => {
    expect(() => decodeLocationData([9])).toThrow("unknown location-data");
    const truncated = decodeLocationData(
      clonePansLocationDataFixture("truncatedDistance"),
    );
    expect(truncated.diagnostics[0]).toContain("truncated distance");
  });

  test("handles combined distance-only and declared count overrun", () => {
    const combinedDistanceOnly = decodeLocationData([
      2, 1, 0x01, 0x00, 0xe8, 0x03, 0, 0, 80,
    ]);

    expect(combinedDistanceOnly.position).toBeUndefined();
    expect(combinedDistanceOnly.distances).toHaveLength(1);

    const overrun = decodeLocationData(
      clonePansLocationDataFixture("overDeclaredDistanceCount"),
    );
    expect(overrun.distances).toHaveLength(1);
    expect(overrun.diagnostics[0]).toContain("truncated distance");
  });

  test("reports location-data trailing bytes and rejects excessive distance counts", () => {
    const trailing = decodeLocationData([
      1, 1, 0x01, 0x00, 0xe8, 0x03, 0, 0, 80, 0xff,
    ]);
    expect(trailing.distances).toHaveLength(1);
    expect(trailing.diagnostics[0]).toContain("trailing byte");

    expect(() => decodeLocationData([1, 16])).toThrow("exceeds maximum 15");
  });

  test.each([
    ["positionOnly18ZeroPadding", "00000000"],
    ["positionOnly18Extension", "deadbeef"],
  ] as const)(
    "decodes the canonical prefix and reproduces the trailing-byte diagnostic for %s",
    (fixtureName, extensionHex) => {
      const decoded = decodeLocationData(
        clonePansLocationDataFixture(fixtureName),
      );

      expect(decoded.position).toMatchObject({
        xMeters: 1,
        yMeters: -2,
        zMeters: 3,
        quality: 77,
      });
      expect(decoded.diagnostics).toEqual([
        "unexpected 4 trailing byte(s) after position frame",
      ]);
      expect(pansBytesToHex(decoded.raw.slice(14))).toBe(extensionHex);
      expect(decoded.raw).toEqual([
        ...PANS_LOCATION_DATA_FIXTURES[fixtureName],
      ]);
    },
  );

  test("decodes the canonical one- and four-anchor distance fixtures", () => {
    expect(
      decodeLocationData(clonePansLocationDataFixture("distanceOnlyOneAnchor"))
        .distances,
    ).toHaveLength(1);
    expect(
      decodeLocationData(
        clonePansLocationDataFixture("distanceOnlyFourAnchors"),
      ).distances,
    ).toHaveLength(4);
  });

  test("decodes maximum distance entries", () => {
    const entries = Array.from({ length: 15 }, (_, index) => [
      ...u16(index + 1),
      ...u32((index + 1) * 1000),
      90,
    ]).flat();

    const decoded = decodeLocationData([1, 15, ...entries]);
    expect(decoded.distances).toHaveLength(15);
    expect(decoded.distances[14].distanceMeters).toBe(15);
  });

  test("decodes proxy positions", () => {
    const decoded = decodeProxyPositions([
      1,
      0x34,
      0x12,
      ...positionBytes(1, 2, 3, 44),
    ]);
    expect(decoded).toEqual([
      {
        nodeId: 0x1234,
        position: {
          xMeters: 0.001,
          yMeters: 0.002,
          zMeters: 0.003,
          quality: 44,
        },
      },
    ]);
  });

  test("handles proxy zero, maximum, and truncated payloads", () => {
    expect(decodeProxyPositions([0])).toEqual([]);
    const entries = Array.from({ length: 5 }, (_, index) => [
      ...u16(index + 1),
      ...positionBytes(index, index + 1, index + 2, 50),
    ]).flat();

    expect(decodeProxyPositions([5, ...entries])).toHaveLength(5);
    expect(() => decodeProxyPositions([2, ...entries.slice(0, 15)])).toThrow(
      "truncated proxy-position",
    );
    expect(() => decodeProxyPositions([6, ...entries])).toThrow(
      "exceeds maximum 5",
    );
    expect(() =>
      decodeProxyPositions([1, ...entries.slice(0, 15), 0xff]),
    ).toThrow("trailing byte");
  });

  test("decodes device info with fixed-width node ID", () => {
    const payload = [
      0xef,
      0xcd,
      0xab,
      0x89,
      0x67,
      0x45,
      0x23,
      0x01,
      ...u32(2),
      ...u32(3),
      ...u32(4),
      ...u32(5),
      ...u32(6),
      0xaa,
    ];
    expect(decodeDeviceInfo(payload)).toMatchObject({
      nodeIdHex: "0123456789abcdef",
      lowNodeId: 0xcdef,
      hardwareVersion: 2,
      operationFlags: 0xaa,
    });
  });

  test("decodes cluster info, anchor list, tag update rate, and advertisements", () => {
    expect(decodeClusterInfo([2, 0x34, 0x12, 0x78, 0x56])).toMatchObject({
      seatNumber: 2,
      clusterMap: 0x1234,
      clusterNeighborMap: 0x5678,
    });

    const anchors = decodeAnchorList([
      1, 0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
    ]);
    expect(anchors.anchors[0]).toEqual({
      nodeIdHex: "0123456789abcdef",
      lowNodeId: 0xcdef,
    });

    expect(decodeTagUpdateRate([...u32(100), ...u32(500)])).toMatchObject({
      movingUpdateRateMs: 100,
      stationaryUpdateRateMs: 500,
    });

    expect(decodePresenceData([0x9a, 7])).toMatchObject({
      rawUwbModeBits: 2,
      role: "anchor",
      errorIndicated: true,
      initiator: true,
      uwbMode: "active",
      changeCounter: 7,
    });

    const unknownPresence = decodePresenceData([0x03, 1]);
    expect(unknownPresence.rawUwbModeBits).toBe(3);
    expect(unknownPresence.uwbMode).toBeUndefined();
  });

  test("preserves anchor-list identities and diagnostics", () => {
    expect(decodeAnchorList([0]).anchors).toEqual([]);
    const maxEntries = Array.from({ length: 16 }, (_, index) => [
      ...u64(index + 1),
    ]).flat();
    expect(decodeAnchorList([16, ...maxEntries]).anchors).toHaveLength(16);
    const multiple = decodeAnchorList([
      2,
      0xef,
      0xcd,
      0xab,
      0x89,
      0x67,
      0x45,
      0x23,
      0x01,
      ...u64(2),
    ]);
    expect(multiple.anchors[0]).toEqual({
      nodeIdHex: "0123456789abcdef",
      lowNodeId: 0xcdef,
    });
    const truncated = decodeAnchorList([2, ...u64(1), 0xff]);
    expect(truncated.anchors).toHaveLength(1);
    expect(truncated.diagnostics[0]).toContain("truncated anchor-list");
    expect(() => decodeAnchorList([17])).toThrow("exceeds maximum 16");
    const trailing = decodeAnchorList([1, ...u64(1), 0xff]);
    expect(trailing.diagnostics[0]).toContain("trailing byte");
  });

  test("encodes and decodes firmware update packets", () => {
    expect(
      encodeFirmwareUpdateOffer({
        hardwareVersion: 1,
        firmwareVersion: 2,
        firmwareChecksum: 3,
        totalBinarySize: 4,
      }),
    ).toEqual([0, ...u32(1), ...u32(2), ...u32(3), ...u32(4)]);

    expect(encodeFirmwareUpdateChunk(8, [1, 2, 3])).toEqual([
      1,
      ...u32(8),
      1,
      2,
      3,
    ]);
    expect(decodeFirmwareUpdatePoll([1, ...u32(16), ...u32(32)])).toMatchObject(
      {
        kind: "request",
        requestedOffset: 16,
        requestedSize: 32,
      },
    );
    expect(decodeFirmwareUpdatePoll([2]).kind).toBe("complete");
    expect(decodeFirmwareUpdatePoll([14]).kind).toBe("invalidChecksum");
    expect(encodeFirmwareUpdateChunk(0, new Array(32).fill(1))).toHaveLength(
      37,
    );
    expect(() => encodeFirmwareUpdateChunk(0, new Array(33).fill(1))).toThrow(
      "at most 32 bytes",
    );
    expect(decodeFirmwareUpdatePoll([0, 99]).raw).toEqual([0, 99]);
  });

  test("rejects invalid firmware update offer fields", () => {
    expect(() =>
      encodeFirmwareUpdateOffer({
        hardwareVersion: -1,
        firmwareVersion: 1,
        firmwareChecksum: 1,
        totalBinarySize: 1,
      }),
    ).toThrow("hardware version");

    expect(() =>
      encodeFirmwareUpdateOffer({
        hardwareVersion: 1,
        firmwareVersion: 1.5,
        firmwareChecksum: 1,
        totalBinarySize: 1,
      }),
    ).toThrow("firmware version");

    expect(() =>
      encodeFirmwareUpdateOffer({
        hardwareVersion: Number.NaN,
        firmwareVersion: 1,
        firmwareChecksum: 1,
        totalBinarySize: 1,
      }),
    ).toThrow("hardware version");

    expect(() =>
      encodeFirmwareUpdateOffer({
        hardwareVersion: 1,
        firmwareVersion: Number.POSITIVE_INFINITY,
        firmwareChecksum: 1,
        totalBinarySize: 1,
      }),
    ).toThrow("firmware version");

    expect(() =>
      encodeFirmwareUpdateOffer({
        hardwareVersion: 1,
        firmwareVersion: 1,
        firmwareChecksum: 0x1_0000_0000,
        totalBinarySize: 1,
      }),
    ).toThrow("firmware checksum");
  });
});

describe("ExpoPansBleApiModule wrapper", () => {
  beforeEach(resetMocks);

  test("wires event listeners", () => {
    const listener = jest.fn();
    expect(addDeviceDiscoveredListener(listener)).toBe(mockSubscription);
    addCharacteristicNotificationListener(listener);
    expect(mockAddListener).toHaveBeenCalledWith(
      ExpoPansBleApiModuleEvents.onDeviceDiscovered,
      listener,
    );
    expect(mockAddListener).toHaveBeenCalledWith(
      ExpoPansBleApiModuleEvents.onCharacteristicNotification,
      listener,
    );
  });

  test("delegates scan and connection controls", async () => {
    await startScanning();
    stopScanning();
    clearDevices();
    await connect("device-1", 5000);
    await disconnect("device-1");

    expect(mockNativeModule.startScanning).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.stopScanning).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.clearDevices).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.connect).toHaveBeenCalledWith("device-1", 5000);
    expect(mockNativeModule.disconnect).toHaveBeenCalledWith("device-1");
    expect(getCapabilities().transport).toBe("ble");
    expect(getScanDiagnostics()).toMatchObject({
      state: "scanning",
      buildId: "test-build",
      rawAdvertisementHitCount: 1,
    });
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid connect timeout %p before native call",
    async (timeoutMs) => {
      await expect(connect("device-1", timeoutMs)).rejects.toThrow(
        "timeoutMs must be a positive integer",
      );
      expect(mockNativeModule.connect).not.toHaveBeenCalled();
    },
  );

  test("rejects unsupported explicit MTU requests when native method is absent", async () => {
    const originalRequestMtu = mockNativeModule.requestMtu;
    try {
      (mockNativeModule as unknown as { requestMtu?: jest.Mock }).requestMtu =
        undefined;
      await expect(requestMtu("device-1", 64)).rejects.toThrow("UNSUPPORTED");
    } finally {
      mockNativeModule.requestMtu = originalRequestMtu;
    }
  });

  test("validates characteristic UUIDs before native calls", async () => {
    await expect(
      writeCharacteristic("device-1", "not-a-uuid", []),
    ).rejects.toThrow("characteristicUuid");
    await expect(writeCharacteristic("device-1", "2a00", [])).rejects.toThrow(
      "canonical 128-bit UUID",
    );
    expect(mockNativeModule.writeCharacteristic).not.toHaveBeenCalled();

    await expect(
      writeCharacteristic(
        "device-1",
        PANS_BLE_UUIDS.characteristics.operationMode,
        [0x40, 0],
      ),
    ).resolves.toBe(true);
  });

  test("maps typed helpers to documented characteristic UUIDs", async () => {
    mockNativeModule.readCharacteristic
      .mockResolvedValueOnce([0, ...positionBytes(1, 2, 3, 4)])
      .mockResolvedValueOnce(new Array(29).fill(0));

    await writeNetworkId("device-1", 0x1234);
    await writeLocationDataMode("device-1", 2);
    await writeOperationMode("device-1", [0xc0, 0x80]);
    await subscribeLocationData("device-1");
    await readLocationData("device-1");
    await readDeviceInfo("device-1");

    expect(mockNativeModule.writeCharacteristic).toHaveBeenNthCalledWith(
      1,
      "device-1",
      PANS_BLE_UUIDS.characteristics.networkId,
      [0x34, 0x12],
      "withResponse",
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenNthCalledWith(
      2,
      "device-1",
      PANS_BLE_UUIDS.characteristics.locationDataMode,
      [2],
      "withResponse",
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenNthCalledWith(
      3,
      "device-1",
      PANS_BLE_UUIDS.characteristics.operationMode,
      [0xc0, 0x80],
      "withResponse",
    );
    expect(
      mockNativeModule.setCharacteristicNotifications,
    ).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.locationData,
      true,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenNthCalledWith(
      1,
      "device-1",
      PANS_BLE_UUIDS.characteristics.locationData,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenNthCalledWith(
      2,
      "device-1",
      PANS_BLE_UUIDS.characteristics.deviceInfo,
    );
  });

  test("maps all public helpers to documented UUIDs", async () => {
    mockNativeModule.readCharacteristic.mockImplementation(
      async (_deviceId, uuid) => {
        if (uuid === PANS_BLE_UUIDS.characteristics.label) return [65];
        if (uuid === PANS_BLE_UUIDS.characteristics.operationMode)
          return [0x40, 0];
        if (uuid === PANS_BLE_UUIDS.characteristics.proxyPositions) return [0];
        if (uuid === PANS_BLE_UUIDS.characteristics.deviceInfo)
          return new Array(29).fill(0);
        if (uuid === PANS_BLE_UUIDS.characteristics.statistics) return [1, 2];
        if (uuid === PANS_BLE_UUIDS.characteristics.macStats) return [3, 4];
        if (uuid === PANS_BLE_UUIDS.characteristics.clusterInfo)
          return [1, 0, 0, 0, 0];
        if (uuid === PANS_BLE_UUIDS.characteristics.anchorList) return [0];
        if (uuid === PANS_BLE_UUIDS.characteristics.updateRate)
          return [...u32(100), ...u32(200)];
        return [];
      },
    );

    await readLabel("device-1");
    await writeLabel("device-1", "A");
    await readOperationMode("device-1");
    await patchOperationMode("device-1", { ledEnabled: true });
    await readProxyPositions("device-1");
    await readStatistics("device-1");
    await readAnchorMacStats("device-1");
    await readClusterInfo("device-1");
    await readAnchorList("device-1");
    await readTagUpdateRate("device-1");
    await requestExplicitDisconnect("device-1");
    await writeFirmwareUpdateOffer("device-1", {
      hardwareVersion: 1,
      firmwareVersion: 2,
      firmwareChecksum: 3,
      totalBinarySize: 4,
    });
    await writeFirmwareUpdateChunk("device-1", 0, [1, 2, 3]);
    await subscribeFirmwareUpdatePoll("device-1");

    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.label,
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.label,
      [65],
      "withResponse",
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.operationMode,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.proxyPositions,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.statistics,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.macStats,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.clusterInfo,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.anchorList,
    );
    expect(mockNativeModule.readCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.updateRate,
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.explicitDisconnect,
      [1],
      "withResponse",
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.firmwareUpdatePush,
      [0, ...u32(1), ...u32(2), ...u32(3), ...u32(4)],
      "withResponse",
    );
    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.firmwareUpdatePush,
      [1, ...u32(0), 1, 2, 3],
      "withoutResponse",
    );
    expect(
      mockNativeModule.setCharacteristicNotifications,
    ).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.firmwareUpdatePoll,
      true,
    );
  });

  test.each([
    ["empty", "", []],
    [
      "exactly 16 ASCII bytes",
      "1234567890ABCDEF",
      Array.from("1234567890ABCDEF").map((char) => char.charCodeAt(0)),
    ],
    [
      "Unicode within 16 UTF-8 bytes",
      "é".repeat(8),
      Array.from(new TextEncoder().encode("é".repeat(8))),
    ],
  ])("writeLabel accepts %s", async (_label, value, expectedPayload) => {
    await expect(writeLabel("device-1", value)).resolves.toBe(true);
    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.label,
      expectedPayload,
      "withResponse",
    );
  });

  test.each([
    ["17 ASCII bytes", "1234567890ABCDEFG"],
    ["Unicode over 16 UTF-8 bytes", "é".repeat(9)],
  ])("writeLabel rejects %s", async (_label, value) => {
    await expect(writeLabel("device-1", value)).rejects.toThrow(
      "label must be at most 16 UTF-8 bytes",
    );
    expect(mockNativeModule.writeCharacteristic).not.toHaveBeenCalled();
  });

  test("patchOperationMode returns updated raw bytes", async () => {
    mockNativeModule.readCharacteristic.mockResolvedValueOnce([0x40, 0x00]);

    await expect(
      patchOperationMode("device-1", { ledEnabled: true }),
    ).resolves.toMatchObject({
      ledEnabled: true,
      raw: [0x44, 0x00],
    });

    expect(mockNativeModule.writeCharacteristic).toHaveBeenCalledWith(
      "device-1",
      PANS_BLE_UUIDS.characteristics.operationMode,
      [0x44, 0x00],
      "withResponse",
    );
  });

  test("prepares and enforces firmware transport sizing", async () => {
    expect(await prepareFirmwareUpdateTransport("device-1")).toEqual({
      maxPacketBytes: 61,
      maxChunkDataBytes: 32,
    });

    mockCapabilities = {
      transport: "ble",
      supportsScanning: true,
      supportsConnection: true,
      supportsNotifications: true,
      supportsMtuRequest: false,
      supportsMaximumWriteValueLength: true,
    };
    mockNativeModule.getMaximumWriteValueLength.mockResolvedValueOnce(20);
    expect(await prepareFirmwareUpdateTransport("device-1")).toEqual({
      maxPacketBytes: 20,
      maxChunkDataBytes: 15,
    });

    await expect(
      writeFirmwareUpdateChunk("device-1", 0, new Array(16).fill(1), {
        maxPacketBytes: 64,
        maxChunkDataBytes: 15,
      }),
    ).rejects.toThrow("transport limits");

    await expect(
      writeFirmwareUpdateChunk("device-1", 0, new Array(16).fill(1), {
        maxPacketBytes: 20,
        maxChunkDataBytes: 32,
      }),
    ).rejects.toThrow("transport limits");

    await expect(
      writeFirmwareUpdateChunk("device-1", 0, [1], {
        maxPacketBytes: 4,
        maxChunkDataBytes: 32,
      }),
    ).rejects.toThrow("transport limits");

    mockNativeModule.getMaximumWriteValueLength.mockResolvedValueOnce(5);
    await expect(prepareFirmwareUpdateTransport("device-1")).rejects.toThrow(
      "cannot carry data chunks",
    );
  });

  test("validates wrapper arguments", async () => {
    await expect(connect("")).rejects.toThrow("deviceId");
    await expect(writeLocationDataMode("device-1", 3 as 0)).rejects.toThrow(
      "location-data mode",
    );
    await expect(writeNetworkId("device-1", 0x1_0000)).rejects.toThrow(
      "PAN ID",
    );
    await expect(
      writeFirmwareUpdateChunk("device-1", 0, [256]),
    ).rejects.toThrow("byte integers");
    expect(() =>
      encodePersistedPosition({ xMeters: 0, yMeters: 0, quality: 0 }),
    ).toThrow("quality");
  });
});

describe("native source hardening regressions", () => {
  const moduleRoot = join(__dirname, "..");
  const androidSource = readFileSync(
    join(
      moduleRoot,
      "android/src/main/java/expo/modules/pansbleapi/ExpoPansBleApiModule.kt",
    ),
    "utf8",
  );
  const iosSource = readFileSync(
    join(moduleRoot, "ios/ExpoPansBleApiModule.swift"),
    "utf8",
  );

  test("Android connectGatt immediate failures use cleanup helper", () => {
    expect(androidSource).toContain("failImmediateConnect(");
    expect(androidSource).toContain("connectGatt returned null");
    expect(androidSource).toContain("connections.remove(deviceId)");
    expect(androidSource).toContain("mainHandler.removeCallbacks(it)");
  });

  test("Android permission and notification rollback remain hardened", () => {
    expect(androidSource).toContain("denied.isNotEmpty()");
    expect(androidSource).toContain("rollbackLocalNotificationState");
    expect(androidSource).toContain("activeNotifyPreviousLocalState");
  });

  test("iOS snapshots bulk closes and defers scan promises", () => {
    expect(iosSource).toContain("Array(self.connections.keys).forEach");
    expect(iosSource).toContain("private var pendingScanPromise: Promise?");
    expect(iosSource).toContain("A scan start is already pending");
    expect(iosSource).toContain(
      'closeAllConnections(reason: "bluetooth unavailable")',
    );
  });
});

function positionBytes(
  xMm: number,
  yMm: number,
  zMm: number,
  quality: number,
): number[] {
  return [...i32(xMm), ...i32(yMm), ...i32(zMm), quality];
}

function i32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return Array.from(bytes);
}

function u32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return Array.from(bytes);
}

function u16(value: number): number[] {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return Array.from(bytes);
}

function u64(value: number): number[] {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return Array.from(bytes);
}
