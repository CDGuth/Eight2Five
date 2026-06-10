import {
  addBeaconDiscoveredListener,
  addBluetoothStateChangedListener,
  addConnectionStateChangedListener,
  addErrorListener,
  addNotifyDataReceivedListener,
  clearBeacons,
  clearSensorHistory,
  connect,
  connectEnhanced,
  disconnect,
  getCapabilities,
  getPermissionStatus,
  modifyConfig,
  readDeviceSnapshot,
  readSensorDataInfo,
  readSensorRecords,
  requestPermissions,
  startScanning,
  stopScanning,
  subscribeNotify,
  subscribeSensorDataNotify,
  unsubscribeNotify,
  unsubscribeSensorDataNotify,
} from "../src/ExpoKBeaconProModule";
import {
  ExpoKBeaconProModuleEvents,
  KBAdvPacket,
  KBAdvType,
  KBConnPara,
  KBeaconConfig,
  KBSensorType,
} from "../src/ExpoKBeaconPro.types";

type NativeModuleMock = {
  addListener: jest.Mock;
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  clearBeacons: jest.Mock;
  getCapabilities: jest.Mock;
  getPermissionStatus: jest.Mock;
  requestPermissions: jest.Mock;
  connect: jest.Mock;
  connectEnhanced: jest.Mock;
  disconnect: jest.Mock;
  modifyConfig: jest.Mock;
  readDeviceSnapshot: jest.Mock;
  readSensorDataInfo: jest.Mock;
  readSensorRecords: jest.Mock;
  clearSensorHistory: jest.Mock;
  subscribeNotify: jest.Mock;
  unsubscribeNotify: jest.Mock;
};

jest.mock("expo-modules-core", () => {
  const mockSubscription = { remove: jest.fn() };
  const mockAddListener = jest.fn().mockReturnValue(mockSubscription);
  const mockNativeModule: NativeModuleMock = {
    addListener: mockAddListener,
    startScanning: jest.fn(async () => undefined),
    stopScanning: jest.fn(),
    clearBeacons: jest.fn(),
    getCapabilities: jest.fn(() => ({
      transport: "ble",
      supportsScanning: true,
      supportsConnection: true,
      supportsConfiguration: true,
      supportsEnhancedConnection: true,
      supportsSensorHistory: true,
      supportsNotifications: true,
      supportsDfu: false,
    })),
    getPermissionStatus: jest.fn(() => ({
      bluetooth: "granted",
      canAskAgain: true,
    })),
    requestPermissions: jest.fn(async () => ({
      bluetooth: "granted",
      canAskAgain: true,
    })),
    connect: jest.fn(async () => true),
    connectEnhanced: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    modifyConfig: jest.fn(async () => true),
    readDeviceSnapshot: jest.fn(async () => ({
      macAddress: "AA:BB",
      common: {
        name: "Field Beacon",
        model: "K15",
        version: "1.2.3",
        maxSlots: 5,
        supportsEddyUid: true,
      },
      slots: [
        {
          configType: "advertisement",
          slotIndex: 0,
          advType: 2,
          nid: "0x45696768743246697665",
          sid: "0x010000000000",
        },
      ],
    })),
    readSensorDataInfo: jest.fn(async () => ({
      totalRecordNum: 5,
      unreadRecordNum: 2,
      readIndex: 1,
    })),
    readSensorRecords: jest.fn(async () => ({
      records: [{ utcTime: 123, raw: [1, 2, 3] }],
    })),
    clearSensorHistory: jest.fn(async () => true),
    subscribeNotify: jest.fn(async () => true),
    unsubscribeNotify: jest.fn(async () => true),
  };

  return {
    EventEmitter: jest.fn().mockImplementation(() => ({
      addListener: mockAddListener,
    })),
    requireNativeModule: jest.fn(() => mockNativeModule),
    __mocks: {
      mockAddListener,
      mockSubscription,
      mockNativeModule,
    },
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

const resetMocks = () => {
  jest.clearAllMocks();
  Object.values(mockNativeModule).forEach((mockFn) => {
    mockFn.mockClear();
  });
  mockAddListener.mockReturnValue(mockSubscription);
};

describe("ExpoKBeaconProModule", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("event listeners", () => {
    test.each([
      [
        "addBeaconDiscoveredListener",
        addBeaconDiscoveredListener,
        ExpoKBeaconProModuleEvents.onBeaconDiscovered,
      ],
      [
        "addConnectionStateChangedListener",
        addConnectionStateChangedListener,
        ExpoKBeaconProModuleEvents.onConnectionStateChanged,
      ],
      [
        "addNotifyDataReceivedListener",
        addNotifyDataReceivedListener,
        ExpoKBeaconProModuleEvents.onNotifyDataReceived,
      ],
      [
        "addBluetoothStateChangedListener",
        addBluetoothStateChangedListener,
        ExpoKBeaconProModuleEvents.onBluetoothStateChanged,
      ],
      [
        "addErrorListener",
        addErrorListener,
        ExpoKBeaconProModuleEvents.onError,
      ],
    ])("%s wires the expected event", (_name, addListener, eventName) => {
      const listener = jest.fn();

      const subscription = addListener(listener as never);

      expect(mockAddListener).toHaveBeenCalledWith(eventName, listener);
      expect(subscription).toBe(mockSubscription);
    });
  });

  describe("native commands", () => {
    test("startScanning awaits native startup", async () => {
      await startScanning();

      expect(mockNativeModule.startScanning).toHaveBeenCalledTimes(1);
    });

    test("startScanning propagates scan failures", async () => {
      mockNativeModule.startScanning.mockRejectedValueOnce(
        new Error("SCAN_FAILED"),
      );

      await expect(startScanning()).rejects.toThrow("SCAN_FAILED");
    });

    test("stopScanning delegates to the native module", () => {
      stopScanning();

      expect(mockNativeModule.stopScanning).toHaveBeenCalledTimes(1);
    });

    test("clearBeacons delegates to the native module", () => {
      clearBeacons();

      expect(mockNativeModule.clearBeacons).toHaveBeenCalledTimes(1);
    });

    test("getCapabilities returns the native capabilities", () => {
      expect(getCapabilities()).toEqual({
        transport: "ble",
        supportsScanning: true,
        supportsConnection: true,
        supportsConfiguration: true,
        supportsEnhancedConnection: true,
        supportsSensorHistory: true,
        supportsNotifications: true,
        supportsDfu: false,
      });
    });

    test("getPermissionStatus returns the native permission status", () => {
      expect(getPermissionStatus()).toEqual({
        bluetooth: "granted",
        canAskAgain: true,
      });
    });

    test("requestPermissions resolves native permission status", async () => {
      await expect(requestPermissions()).resolves.toEqual({
        bluetooth: "granted",
        canAskAgain: true,
      });
    });

    test("connect forwards timeout in milliseconds", async () => {
      const macAddress = "AA:BB:CC:DD:EE:FF";
      const password = "123456";
      const timeoutMs = 15_000;

      const result = await connect(macAddress, password, timeoutMs);

      expect(mockNativeModule.connect).toHaveBeenCalledWith(
        macAddress,
        password,
        timeoutMs,
      );
      expect(result).toBe(true);
    });

    test("connect uses the default millisecond timeout", async () => {
      await connect("AA:BB");

      expect(mockNativeModule.connect).toHaveBeenCalledWith(
        "AA:BB",
        undefined,
        15_000,
      );
    });

    test("connect rejects invalid timeout values before native call", async () => {
      await expect(connect("AA:BB", undefined, 0)).rejects.toThrow(
        "timeoutMs must be a positive integer",
      );
      expect(mockNativeModule.connect).not.toHaveBeenCalled();
    });

    test("connectEnhanced forwards connection parameters", async () => {
      const connPara: KBConnPara = {
        syncUtcTime: true,
        readCommPara: true,
      };

      await connectEnhanced("AA:BB", "pwd", 30_000, connPara);

      expect(mockNativeModule.connectEnhanced).toHaveBeenCalledWith(
        "AA:BB",
        "pwd",
        30_000,
        connPara,
      );
    });

    test("disconnect delegates to the native module", async () => {
      await disconnect("AA:BB");

      expect(mockNativeModule.disconnect).toHaveBeenCalledWith("AA:BB");
    });

    test("modifyConfig sends strict canonical configs", async () => {
      const configs: KBeaconConfig[] = [
        { configType: "common", refPower1Meters: -59 },
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          nid: "0x45696768743246697665",
          sid: "0x010000000000",
          advConnectable: true,
        },
      ];

      await modifyConfig("AA:BB", configs);

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(
        "AA:BB",
        configs,
      );
    });

    test("modifyConfig rejects malformed configs", async () => {
      await expect(
        modifyConfig("AA:BB", [{} as KBeaconConfig]),
      ).rejects.toThrow("configuration at index 0");

      expect(mockNativeModule.modifyConfig).not.toHaveBeenCalled();
    });

    test("modifyConfig rejects unsafe all-non-connectable advertisement updates", async () => {
      const configs: KBeaconConfig[] = [
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          advConnectable: false,
        },
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 1,
          advConnectable: false,
        },
      ];

      await expect(modifyConfig("AA:BB", configs)).rejects.toThrow(
        "refusing to disable connectability",
      );
      expect(mockNativeModule.modifyConfig).not.toHaveBeenCalled();
    });

    test("modifyConfig allows explicit unsafe connectability override", async () => {
      const configs: KBeaconConfig[] = [
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          advConnectable: false,
        },
      ];

      await modifyConfig("AA:BB", configs, {
        allowDisableAllConnectableSlots: true,
      });

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(
        "AA:BB",
        configs,
      );
    });

    test("readDeviceSnapshot returns the native snapshot", async () => {
      await expect(readDeviceSnapshot("AA:BB")).resolves.toEqual({
        macAddress: "AA:BB",
        common: {
          name: "Field Beacon",
          model: "K15",
          version: "1.2.3",
          maxSlots: 5,
          supportsEddyUid: true,
        },
        slots: [
          {
            configType: "advertisement",
            slotIndex: 0,
            advType: 2,
            nid: "0x45696768743246697665",
            sid: "0x010000000000",
          },
        ],
      });
      expect(mockNativeModule.readDeviceSnapshot).toHaveBeenCalledWith("AA:BB");
    });

    test("readDeviceSnapshot preserves omitted optional fields", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: "AA:BB",
        slots: [{ configType: "advertisement", slotIndex: 1, advType: 2 }],
      });

      await expect(readDeviceSnapshot("AA:BB")).resolves.toEqual({
        macAddress: "AA:BB",
        slots: [{ configType: "advertisement", slotIndex: 1, advType: 2 }],
      });
    });

    test("readDeviceSnapshot accepts snapshot without slots", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: "AA:BB",
        common: { name: "Field Beacon" },
      });

      const snapshot = await readDeviceSnapshot("AA:BB");

      expect(snapshot).toEqual({
        macAddress: "AA:BB",
        common: { name: "Field Beacon" },
      });
      expect(snapshot).not.toHaveProperty("slots");
    });

    test("readDeviceSnapshot distinguishes omitted slots from empty loaded slots", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: "AA:BB",
        slots: [],
      });

      const snapshotWithEmptySlots = await readDeviceSnapshot("AA:BB");
      expect(snapshotWithEmptySlots.slots).toEqual([]);
      expect(snapshotWithEmptySlots).toHaveProperty("slots");

      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: "AA:BB",
      });

      const snapshotWithoutSlots = await readDeviceSnapshot("AA:BB");
      expect(snapshotWithoutSlots).not.toHaveProperty("slots");
    });

    test("readSensorDataInfo returns the native payload", async () => {
      const info = await readSensorDataInfo("AA:BB", KBSensorType.HTHumidity);

      expect(mockNativeModule.readSensorDataInfo).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.HTHumidity,
      );
      expect(info).toEqual({
        totalRecordNum: 5,
        unreadRecordNum: 2,
        readIndex: 1,
      });
    });

    test("readSensorDataInfo accepts iOS-shaped response without readIndex", async () => {
      mockNativeModule.readSensorDataInfo.mockResolvedValueOnce({
        totalRecordNum: 10,
        unreadRecordNum: 3,
      });

      const info = await readSensorDataInfo("AA:BB", KBSensorType.HTHumidity);

      expect(info).toEqual({
        totalRecordNum: 10,
        unreadRecordNum: 3,
      });
      expect(info).not.toHaveProperty("readIndex");
    });

    test("readSensorDataInfo accepts Android-shaped response with readIndex", async () => {
      mockNativeModule.readSensorDataInfo.mockResolvedValueOnce({
        totalRecordNum: 20,
        unreadRecordNum: 5,
        readIndex: 15,
      });

      const info = await readSensorDataInfo("AA:BB", KBSensorType.Light);

      expect(info).toEqual({
        totalRecordNum: 20,
        unreadRecordNum: 5,
        readIndex: 15,
      });
    });

    test("readSensorRecords forwards typed record requests", async () => {
      const request = {
        sensorType: KBSensorType.PIR,
        readPosition: 10,
        maxRecords: 50,
      };

      await readSensorRecords("AA:BB", request);

      expect(mockNativeModule.readSensorRecords).toHaveBeenCalledWith(
        "AA:BB",
        request,
      );
    });

    test("readSensorRecords rejects invalid maximum record counts", async () => {
      await expect(
        readSensorRecords("AA:BB", {
          sensorType: KBSensorType.PIR,
          maxRecords: 0,
        }),
      ).rejects.toThrow("maxRecords");
    });

    test("readSensorRecords rejects unsupported read options", async () => {
      await expect(
        readSensorRecords("AA:BB", {
          sensorType: KBSensorType.PIR,
          readOption: 1,
          maxRecords: 10,
        } as never),
      ).rejects.toThrow("readOption is not supported");
      expect(mockNativeModule.readSensorRecords).not.toHaveBeenCalled();
    });

    test("readSensorRecords rejects invalid read positions", async () => {
      await expect(
        readSensorRecords("AA:BB", {
          sensorType: KBSensorType.PIR,
          readPosition: -1,
          maxRecords: 10,
        }),
      ).rejects.toThrow("readPosition");
    });

    test("readSensorRecords forwards omitted readPosition without validation error", async () => {
      const request = {
        sensorType: KBSensorType.PIR,
        maxRecords: 10,
      };

      await readSensorRecords("AA:BB", request);

      expect(mockNativeModule.readSensorRecords).toHaveBeenCalledWith(
        "AA:BB",
        request,
      );
    });

    test("readSensorRecords preserves raw unknown payload data", async () => {
      await expect(
        readSensorRecords("AA:BB", {
          sensorType: KBSensorType.PIR,
          maxRecords: 10,
        }),
      ).resolves.toEqual({ records: [{ utcTime: 123, raw: [1, 2, 3] }] });
    });

    test("clearSensorHistory delegates to the native bridge", async () => {
      await clearSensorHistory("AA:BB", KBSensorType.Light);

      expect(mockNativeModule.clearSensorHistory).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.Light,
      );
    });

    test("subscribeNotify delegates to the native bridge", async () => {
      await subscribeNotify("AA:BB", 7);

      expect(mockNativeModule.subscribeNotify).toHaveBeenCalledWith("AA:BB", 7);
    });

    test("unsubscribeNotify delegates to the native bridge", async () => {
      await unsubscribeNotify("AA:BB", 7);

      expect(mockNativeModule.unsubscribeNotify).toHaveBeenCalledWith(
        "AA:BB",
        7,
      );
    });

    test("sensor notification compatibility wrappers delegate to generalized API", async () => {
      await subscribeSensorDataNotify("AA:BB", KBSensorType.VOC);
      await unsubscribeSensorDataNotify("AA:BB", KBSensorType.VOC);

      expect(mockNativeModule.subscribeNotify).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.VOC,
      );
      expect(mockNativeModule.unsubscribeNotify).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.VOC,
      );
    });
  });
});

describe("canonical packet parity fixtures", () => {
  const packets: KBAdvPacket[] = [
    {
      advType: KBAdvType.IBeacon,
      uuid: "00000000-0000-0000-0000-000000000000",
      majorID: 1,
      minorID: 2,
    },
    {
      advType: KBAdvType.EddyUID,
      nid: "0x45696768743246697665",
      sid: "0x010000000000",
    },
    { advType: KBAdvType.EddyURL, url: "https://example.com" },
    {
      advType: KBAdvType.EddyTLM,
      batteryLevel: 95,
      temperature: 20.5,
      advCount: 10,
      secCount: 20,
    },
    {
      advType: KBAdvType.Sensor,
      batteryLevel: 90,
      temperature: 21,
      humidity: 50,
      accSensor: { xAis: 1, yAis: 2, zAis: 3 },
      luxValue: 42,
    },
    {
      advType: KBAdvType.System,
      macAddress: "AA:BB:CC:DD:EE:FF",
      model: "KBeacon",
      batteryPercent: 80,
      version: "1.0.0",
    },
    {
      advType: KBAdvType.EBeacon,
      mac: "AA:BB:CC:DD:EE:FF",
      uuid: "e-beacon",
      utcSecCount: 123,
      refTxPower: -59,
    },
    { advType: KBAdvType.Unknown, raw: { vendorType: "future" } },
  ];

  test("Eddystone UID fixture uses canonical nid and sid fields", () => {
    const uidPacket = packets.find(
      (packet) => packet.advType === KBAdvType.EddyUID,
    );

    expect(uidPacket).toEqual({
      advType: KBAdvType.EddyUID,
      nid: "0x45696768743246697665",
      sid: "0x010000000000",
    });
    expect(uidPacket).not.toHaveProperty("bid");
  });
});
