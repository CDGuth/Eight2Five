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
  readDeviceInfo,
  readLocationData,
  startScanning,
  stopScanning,
  subscribeLocationData,
  writeLocationDataMode,
  writeNetworkId,
  writeOperationMode,
} from "../src/ExpoPansBleApiModule";
import {
  ExpoPansBleApiModuleEvents,
  PANS_BLE_UUIDS,
} from "../src/ExpoPansBleApi.types";

type NativeModuleMock = {
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  clearDevices: jest.Mock;
  getCapabilities: jest.Mock;
  getPermissionStatus: jest.Mock;
  requestPermissions: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  readCharacteristic: jest.Mock;
  writeCharacteristic: jest.Mock;
  setCharacteristicNotifications: jest.Mock;
  requestMtu: jest.Mock;
};

jest.mock("expo-modules-core", () => {
  const mockSubscription = { remove: jest.fn() };
  const mockAddListener = jest.fn().mockReturnValue(mockSubscription);
  const mockNativeModule: NativeModuleMock = {
    startScanning: jest.fn(async () => undefined),
    stopScanning: jest.fn(),
    clearDevices: jest.fn(),
    getCapabilities: jest.fn(() => ({
      transport: "ble",
      supportsScanning: true,
      supportsConnection: true,
      supportsNotifications: true,
      supportsMtuRequest: true,
      supportsMaximumWriteValueLength: false,
    })),
    getPermissionStatus: jest.fn(() => ({ bluetooth: "granted" })),
    requestPermissions: jest.fn(async () => ({ bluetooth: "granted" })),
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    readCharacteristic: jest.fn(async () => []),
    writeCharacteristic: jest.fn(async () => true),
    setCharacteristicNotifications: jest.fn(async () => true),
    requestMtu: jest.fn(async (_deviceId, mtu: number) => mtu),
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

  test("decodes empty, position, distances, and combined location frames", () => {
    expect(decodeLocationData([])).toEqual({
      distances: [],
      raw: [],
      diagnostics: [],
    });

    const positionOnly = decodeLocationData([
      0,
      ...positionBytes(1000, -2000, 3000, 77),
    ]);
    expect(positionOnly.position).toMatchObject({
      xMeters: 1,
      yMeters: -2,
      zMeters: 3,
      quality: 77,
    });

    const distanceOnly = decodeLocationData([
      1, 1, 0x34, 0x12, 0xe8, 0x03, 0, 0, 90,
    ]);
    expect(distanceOnly.distances[0]).toMatchObject({
      nodeId: 0x1234,
      distanceMeters: 1,
      quality: 90,
    });

    const combined = decodeLocationData([
      2,
      ...positionBytes(10, 20, 30, 55),
      1,
      0x78,
      0x56,
      0xd0,
      0x07,
      0,
      0,
      91,
    ]);
    expect(combined.position?.zMeters).toBe(0.03);
    expect(combined.distances[0].nodeId).toBe(0x5678);
  });

  test("reports malformed location diagnostics", () => {
    expect(() => decodeLocationData([9])).toThrow("unknown location-data");
    const truncated = decodeLocationData([1, 2, 0x01]);
    expect(truncated.diagnostics[0]).toContain("truncated distance");
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
      role: "anchor",
      errorIndicated: true,
      initiator: true,
      uwbMode: "active",
      changeCounter: 7,
    });
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
