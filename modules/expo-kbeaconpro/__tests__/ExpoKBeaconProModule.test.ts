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
  unsubscribeNotify,
  validateConfigAgainstSnapshot,
} from "../src/ExpoKBeaconProModule";
import {
  ExpoKBeaconProModuleEvents,
  KBAdvPacket,
  KBAdvType,
  KBConnEvtReason,
  KBConnPara,
  KBeaconConfig,
  KBeaconErrorCode,
  KBSensorReadOption,
  KBSensorType,
} from "../src/ExpoKBeaconPro.types";

const MAC = "AA:BB:CC:DD:EE:FF";
const PASSWORD = "1234567890abcdef";

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
      macAddress: MAC,
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
      sensorType: 1,
      totalRecordNum: 5,
      unreadRecordNum: 2,
      readInfoUtcSeconds: 123456,
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

    test("public error codes include deferred scan cancellation", () => {
      const code: KBeaconErrorCode = "SCAN_CANCELLED";

      expect(code).toBe("SCAN_CANCELLED");
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
      const macAddress = " aa:bb:cc:dd:ee:ff ";
      const password = PASSWORD;
      const timeoutMs = 15_000;

      const result = await connect(macAddress, password, timeoutMs);

      expect(mockNativeModule.connect).toHaveBeenCalledWith(
        MAC,
        password,
        timeoutMs,
      );
      expect(result).toBe(true);
    });

    test("connect uses the default millisecond timeout", async () => {
      await connect(MAC);

      expect(mockNativeModule.connect).toHaveBeenCalledWith(
        MAC,
        undefined,
        15_000,
      );
    });

    test("connect rejects invalid timeout values before native call", async () => {
      await expect(connect(MAC, undefined, 0)).rejects.toThrow(
        "timeoutMs must be a positive integer",
      );
      expect(mockNativeModule.connect).not.toHaveBeenCalled();
    });

    test("connect rejects malformed MAC addresses and short passwords", async () => {
      await expect(connect("AA:BB")).rejects.toThrow("canonical");
      await expect(connect(MAC, "short")).rejects.toThrow(
        "password must be exactly 16 characters",
      );
      await connect(MAC, "");
      expect(mockNativeModule.connect).toHaveBeenCalledWith(MAC, "", 15_000);
    });

    test("connectEnhanced forwards connection parameters", async () => {
      const connPara: KBConnPara = {
        syncUtcTime: true,
        readCommPara: true,
      };

      await connectEnhanced(MAC, PASSWORD, 30_000, connPara);

      expect(mockNativeModule.connectEnhanced).toHaveBeenCalledWith(
        MAC,
        PASSWORD,
        30_000,
        connPara,
      );
    });

    test("disconnect delegates to the native module", async () => {
      await disconnect(MAC);

      expect(mockNativeModule.disconnect).toHaveBeenCalledWith(MAC);
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

      await modifyConfig(MAC, configs);

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(MAC, configs);
    });

    test("modifyConfig accepts fractional trigger advertising periods", async () => {
      const configs: KBeaconConfig[] = [
        {
          configType: "trigger",
          triggerIndex: 0,
          triggerType: 5,
          triggerAdvPeriod: 125.5,
        },
      ];

      await modifyConfig(MAC, configs);

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(MAC, configs);
    });

    test("modifyConfig rejects malformed configs", async () => {
      await expect(modifyConfig(MAC, [{} as KBeaconConfig])).rejects.toThrow(
        "configuration at index 0",
      );

      expect(mockNativeModule.modifyConfig).not.toHaveBeenCalled();
    });

    test.each([
      [
        "non-finite txPower",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          txPower: Number.NaN,
        },
        "txPower",
      ],
      [
        "fractional slotIndex",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0.5,
        },
        "slotIndex",
      ],
      [
        "overflowing majorID",
        {
          configType: "advertisement",
          advType: KBAdvType.IBeacon,
          slotIndex: 0,
          majorID: 65_536,
        },
        "majorID",
      ],
      [
        "invalid UUID",
        {
          configType: "advertisement",
          advType: KBAdvType.IBeacon,
          slotIndex: 0,
          uuid: "not-a-uuid",
        },
        "uuid",
      ],
      [
        "invalid NID length",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          nid: "0x1234",
        },
        "nid",
      ],
      [
        "invalid SID hex",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          sid: "0xnot-hex-data",
        },
        "sid",
      ],
      [
        "fractional trigger field",
        {
          configType: "trigger",
          triggerIndex: 0,
          triggerType: 5,
          wakeupDuration: 1.5,
        },
        "wakeupDuration",
      ],
      [
        "non-finite trigger advertising period",
        {
          configType: "trigger",
          triggerIndex: 0,
          triggerType: 5,
          triggerAdvPeriod: Number.POSITIVE_INFINITY,
        },
        "triggerAdvPeriod",
      ],
      [
        "unsupported sensor config type",
        {
          configType: "sensor",
          sensorType: KBSensorType.VOC,
        },
        "sensorType",
      ],
      [
        "invalid common boolean",
        {
          configType: "common",
          alwaysPowerOn: "true",
        },
        "alwaysPowerOn",
      ],
      [
        "invalid advertisement boolean",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyUID,
          slotIndex: 0,
          advConnectable: "false",
        },
        "advConnectable",
      ],
      [
        "invalid URL string",
        {
          configType: "advertisement",
          advType: KBAdvType.EddyURL,
          slotIndex: 0,
          url: 123,
        },
        "url",
      ],
      [
        "invalid sensor log boolean",
        {
          configType: "sensor",
          sensorType: KBSensorType.Light,
          logEnable: 1,
        },
        "logEnable",
      ],
      [
        "invalid parking tag boolean",
        {
          configType: "sensor",
          sensorType: KBSensorType.GEO,
          parkingTag: "yes",
        },
        "parkingTag",
      ],
      [
        "unsafe integer",
        {
          configType: "sensor",
          sensorType: KBSensorType.Scan,
          scanMax: Number.MAX_SAFE_INTEGER + 1,
        },
        "scanMax",
      ],
    ])("modifyConfig rejects %s", async (_name, config, message) => {
      await expect(
        modifyConfig(MAC, [config as KBeaconConfig]),
      ).rejects.toThrow(message);
      expect(mockNativeModule.modifyConfig).not.toHaveBeenCalled();
    });

    test("modifyConfig validates common passwords before native calls", async () => {
      await expect(
        modifyConfig(MAC, [{ configType: "common", password: "pässword" }]),
      ).rejects.toThrow("password must be exactly 16 characters");
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

      await expect(modifyConfig(MAC, configs)).rejects.toThrow(
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

      await modifyConfig(MAC, configs, {
        allowDisableAllConnectableSlots: true,
      });

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(MAC, configs);
    });

    test("modifyConfig evaluates post-update connectability when snapshot is supplied", async () => {
      const snapshot = {
        macAddress: MAC,
        slots: [
          {
            configType: "advertisement" as const,
            slotIndex: 0,
            advType: KBAdvType.EddyUID,
            advConnectable: true,
          },
          {
            configType: "advertisement" as const,
            slotIndex: 1,
            advType: KBAdvType.EddyUID,
            advConnectable: false,
          },
        ],
      };

      await expect(
        modifyConfig(
          MAC,
          [
            {
              configType: "advertisement",
              advType: KBAdvType.EddyUID,
              slotIndex: 0,
              advConnectable: false,
            },
          ],
          { snapshot },
        ),
      ).rejects.toThrow("every advertisement slot");

      snapshot.slots[1].advConnectable = true;
      await expect(
        modifyConfig(
          MAC,
          [
            {
              configType: "advertisement",
              advType: KBAdvType.EddyUID,
              slotIndex: 0,
              advConnectable: false,
            },
          ],
          { snapshot },
        ),
      ).resolves.toBe(true);
    });

    test("validateConfigAgainstSnapshot rejects incompatible capabilities", () => {
      const snapshot = {
        macAddress: MAC,
        common: {
          maxSlots: 1,
          maxTriggers: 1,
          minTxPower: -20,
          maxTxPower: 4,
          supportsEddyUid: false,
          supportsLight: false,
        },
      };

      expect(() =>
        validateConfigAgainstSnapshot(
          [
            {
              configType: "advertisement",
              advType: KBAdvType.EddyUID,
              slotIndex: 1,
            },
          ],
          snapshot,
        ),
      ).toThrow("maxSlots");
      expect(() =>
        validateConfigAgainstSnapshot(
          [
            {
              configType: "advertisement",
              advType: KBAdvType.EddyUID,
              slotIndex: 0,
              txPower: 8,
            },
          ],
          snapshot,
        ),
      ).toThrow("txPower");
      expect(() =>
        validateConfigAgainstSnapshot(
          [
            {
              configType: "advertisement",
              advType: KBAdvType.EddyUID,
              slotIndex: 0,
            },
          ],
          snapshot,
        ),
      ).toThrow("unsupported advertisement type");
      expect(() =>
        validateConfigAgainstSnapshot(
          [{ configType: "trigger", triggerIndex: 1, triggerType: 5 }],
          snapshot,
        ),
      ).toThrow("maxTriggers");
      expect(() =>
        validateConfigAgainstSnapshot(
          [{ configType: "sensor", sensorType: KBSensorType.Light }],
          snapshot,
        ),
      ).toThrow("unsupported sensor type");
    });

    test("readDeviceSnapshot returns the native snapshot", async () => {
      await expect(readDeviceSnapshot(MAC)).resolves.toEqual({
        macAddress: MAC,
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
      expect(mockNativeModule.readDeviceSnapshot).toHaveBeenCalledWith(MAC);
    });

    test("readDeviceSnapshot preserves omitted optional fields", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: MAC,
        slots: [{ configType: "advertisement", slotIndex: 1, advType: 2 }],
      });

      await expect(readDeviceSnapshot(MAC)).resolves.toEqual({
        macAddress: MAC,
        slots: [{ configType: "advertisement", slotIndex: 1, advType: 2 }],
      });
    });

    test("readDeviceSnapshot accepts snapshot without slots", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: MAC,
        common: { name: "Field Beacon" },
      });

      const snapshot = await readDeviceSnapshot(MAC);

      expect(snapshot).toEqual({
        macAddress: MAC,
        common: { name: "Field Beacon" },
      });
      expect(snapshot).not.toHaveProperty("slots");
    });

    test("readDeviceSnapshot distinguishes omitted slots from empty loaded slots", async () => {
      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: MAC,
        slots: [],
      });

      const snapshotWithEmptySlots = await readDeviceSnapshot(MAC);
      expect(snapshotWithEmptySlots.slots).toEqual([]);
      expect(snapshotWithEmptySlots).toHaveProperty("slots");

      mockNativeModule.readDeviceSnapshot.mockResolvedValueOnce({
        macAddress: MAC,
      });

      const snapshotWithoutSlots = await readDeviceSnapshot(MAC);
      expect(snapshotWithoutSlots).not.toHaveProperty("slots");
    });

    test("readSensorDataInfo returns the native payload", async () => {
      const info = await readSensorDataInfo(MAC, KBSensorType.HTHumidity);

      expect(mockNativeModule.readSensorDataInfo).toHaveBeenCalledWith(
        MAC,
        KBSensorType.HTHumidity,
      );
      expect(info).toEqual({
        sensorType: KBSensorType.HTHumidity,
        totalRecordNum: 5,
        unreadRecordNum: 2,
        readInfoUtcSeconds: 123456,
      });
    });

    test("readSensorDataInfo does not require readIndex", async () => {
      mockNativeModule.readSensorDataInfo.mockResolvedValueOnce({
        totalRecordNum: 10,
        unreadRecordNum: 3,
      });

      const info = await readSensorDataInfo(MAC, KBSensorType.HTHumidity);

      expect(info).toEqual({
        totalRecordNum: 10,
        unreadRecordNum: 3,
      });
      expect(info).not.toHaveProperty("readIndex");
    });

    test("readSensorDataInfo accepts Android-shaped response metadata", async () => {
      mockNativeModule.readSensorDataInfo.mockResolvedValueOnce({
        sensorType: KBSensorType.Light,
        totalRecordNum: 20,
        unreadRecordNum: 5,
        readInfoUtcSeconds: 987654,
      });

      const info = await readSensorDataInfo(MAC, KBSensorType.Light);

      expect(info).toEqual({
        sensorType: KBSensorType.Light,
        totalRecordNum: 20,
        unreadRecordNum: 5,
        readInfoUtcSeconds: 987654,
      });
      expect(info).not.toHaveProperty("readIndex");
    });

    test("readSensorRecords forwards typed record requests with read options", async () => {
      const request = {
        sensorType: KBSensorType.PIR,
        readPosition: 10,
        readOption: KBSensorReadOption.ReverseOrder,
        maxRecords: 50,
      };

      await readSensorRecords(MAC, request);

      expect(mockNativeModule.readSensorRecords).toHaveBeenCalledWith(
        MAC,
        request,
      );
    });

    test("readSensorRecords rejects invalid maximum record counts", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readOption: KBSensorReadOption.NormalOrder,
          maxRecords: 0,
        }),
      ).rejects.toThrow("maxRecords");
    });

    test("readSensorRecords rejects invalid read options", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readOption: 99,
          maxRecords: 10,
        } as never),
      ).rejects.toThrow("readOption must be 0, 1, or 2");
      expect(mockNativeModule.readSensorRecords).not.toHaveBeenCalled();
    });

    test("readSensorRecords rejects omitted readOption", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          maxRecords: 10,
        } as never),
      ).rejects.toThrow("readOption must be 0, 1, or 2");
      expect(mockNativeModule.readSensorRecords).not.toHaveBeenCalled();
    });

    test("readSensorRecords rejects negative read positions", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readPosition: -1,
          readOption: KBSensorReadOption.NormalOrder,
          maxRecords: 10,
        }),
      ).rejects.toThrow("readPosition");
    });

    test("readSensorRecords rejects out-of-range read positions", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readPosition: 0x1_0000_0000,
          readOption: KBSensorReadOption.NormalOrder,
          maxRecords: 10,
        }),
      ).rejects.toThrow(
        "readPosition must be an integer between 0 and 4294967295",
      );
    });

    test("readSensorRecords forwards omitted readPosition without validation error", async () => {
      const request = {
        sensorType: KBSensorType.PIR,
        readOption: KBSensorReadOption.NewRecord,
        maxRecords: 10,
      };

      await readSensorRecords(MAC, request);

      expect(mockNativeModule.readSensorRecords).toHaveBeenCalledWith(
        MAC,
        request,
      );
    });

    test("readSensorRecords preserves raw unknown payload data", async () => {
      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readOption: KBSensorReadOption.NormalOrder,
          maxRecords: 10,
        }),
      ).resolves.toEqual({ records: [{ utcTime: 123, raw: [1, 2, 3] }] });
    });

    test("readSensorRecords preserves nextReadPosition", async () => {
      mockNativeModule.readSensorRecords.mockResolvedValueOnce({
        nextReadPosition: 44,
        records: [{ utcTime: 123, raw: [1, 2, 3] }],
      });

      await expect(
        readSensorRecords(MAC, {
          sensorType: KBSensorType.PIR,
          readOption: KBSensorReadOption.NormalOrder,
          maxRecords: 10,
        }),
      ).resolves.toEqual({
        nextReadPosition: 44,
        records: [{ utcTime: 123, raw: [1, 2, 3] }],
      });
    });

    test("readSensorRecords accepts completed reads without nextReadPosition", async () => {
      mockNativeModule.readSensorRecords.mockResolvedValueOnce({
        records: [{ utcTime: 123, raw: [1, 2, 3] }],
      });

      const result = await readSensorRecords(MAC, {
        sensorType: KBSensorType.PIR,
        readOption: KBSensorReadOption.NormalOrder,
        maxRecords: 10,
      });

      expect(result).toEqual({ records: [{ utcTime: 123, raw: [1, 2, 3] }] });
      expect(result).not.toHaveProperty("nextReadPosition");
    });

    test("clearSensorHistory delegates to the native bridge", async () => {
      await clearSensorHistory(MAC, KBSensorType.Light);

      expect(mockNativeModule.clearSensorHistory).toHaveBeenCalledWith(
        MAC,
        KBSensorType.Light,
      );
    });

    test("subscribeNotify delegates to the native bridge", async () => {
      await subscribeNotify(MAC, 7);

      expect(mockNativeModule.subscribeNotify).toHaveBeenCalledWith(MAC, 7);
    });

    test("subscribeNotify requires an explicit eventType", async () => {
      await expect(subscribeNotify(MAC, undefined as never)).rejects.toThrow(
        "eventType must be an integer",
      );
      expect(mockNativeModule.subscribeNotify).not.toHaveBeenCalled();
    });

    test("subscribeNotify rejects negative event types", async () => {
      await expect(subscribeNotify(MAC, -1)).rejects.toThrow(
        "eventType must be a non-negative integer",
      );
      expect(mockNativeModule.subscribeNotify).not.toHaveBeenCalled();
    });

    test("unsubscribeNotify delegates to the native bridge", async () => {
      await unsubscribeNotify(MAC, 7);

      expect(mockNativeModule.unsubscribeNotify).toHaveBeenCalledWith(MAC, 7);
    });

    test("unsubscribeNotify requires an explicit eventType", async () => {
      await expect(unsubscribeNotify(MAC, undefined as never)).rejects.toThrow(
        "eventType must be an integer",
      );
      expect(mockNativeModule.unsubscribeNotify).not.toHaveBeenCalled();
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

describe("stable public enums", () => {
  test("KBConnEvtReason includes normalized cross-platform reason values", () => {
    expect(KBConnEvtReason).toMatchObject({
      ConnDefault: 0,
      ConnException: 1,
      ConnTimeout: 2,
      ConnAuthFail: 3,
      ConnBleClosed: 4,
      ConnBleBusy: 5,
      ConnNotSupport: 6,
      ConnManualDisconnect: 7,
      ConnSuccess: 256,
    });
  });
});
