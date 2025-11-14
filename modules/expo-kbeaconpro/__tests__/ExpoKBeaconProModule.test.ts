import {
  addBeaconDiscoveredListener,
  addConnectionStateChangedListener,
  addNotifyDataReceivedListener,
  startScanning,
  stopScanning,
  clearBeacons,
  connect,
  connectEnhanced,
  disconnect,
  modifyConfig,
  readSensorDataInfo,
  readSensorHistory,
  clearSensorHistory,
  subscribeSensorDataNotify,
  unsubscribeSensorDataNotify,
} from "../src/ExpoKBeaconProModule";
import {
  ExpoKBeaconProModuleEvents,
  KBConnPara,
  KBSensorType,
  KBCfgBase,
} from "../src/ExpoKBeaconPro.types";

type NativeModuleMock = {
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  clearBeacons: jest.Mock;
  connect: jest.Mock;
  connectEnhanced: jest.Mock;
  disconnect: jest.Mock;
  modifyConfig: jest.Mock;
  readSensorDataInfo: jest.Mock;
  readSensorHistory: jest.Mock;
  clearSensorHistory: jest.Mock;
  subscribeSensorDataNotify: jest.Mock;
  unsubscribeSensorDataNotify: jest.Mock;
};

jest.mock("expo-modules-core", () => {
  const mockSubscription = { remove: jest.fn() };
  const mockAddListener = jest.fn().mockReturnValue(mockSubscription);
  const mockNativeModule: NativeModuleMock = {
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    clearBeacons: jest.fn(),
    connect: jest.fn(async () => true),
    connectEnhanced: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    modifyConfig: jest.fn(async () => true),
    readSensorDataInfo: jest.fn(async () => ({
      totalRecordNum: 5,
      unreadRecordNum: 2,
      readIndex: 1,
    })),
    readSensorHistory: jest.fn(async () => []),
    clearSensorHistory: jest.fn(async () => true),
    subscribeSensorDataNotify: jest.fn(async () => true),
    unsubscribeSensorDataNotify: jest.fn(async () => true),
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
    if (typeof mockFn === "function") {
      mockFn.mockClear();
    }
  });
  mockAddListener.mockClear();
  mockAddListener.mockReturnValue(mockSubscription);
  mockSubscription.remove.mockClear();
};

describe("ExpoKBeaconProModule", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("event listeners", () => {
    test("addBeaconDiscoveredListener wires the onBeaconDiscovered event", () => {
      const listener = jest.fn();

      const subscription = addBeaconDiscoveredListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoKBeaconProModuleEvents.onBeaconDiscovered,
        listener,
      );
      expect(subscription).toBe(mockSubscription);
    });

    test("addConnectionStateChangedListener wires the onConnectionStateChanged event", () => {
      const listener = jest.fn();

      addConnectionStateChangedListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoKBeaconProModuleEvents.onConnectionStateChanged,
        listener,
      );
    });

    test("addNotifyDataReceivedListener wires the onNotifyDataReceived event", () => {
      const listener = jest.fn();

      addNotifyDataReceivedListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoKBeaconProModuleEvents.onNotifyDataReceived,
        listener,
      );
    });
  });

  describe("native commands", () => {
    test("startScanning delegates to the native module", () => {
      startScanning();

      expect(mockNativeModule.startScanning).toHaveBeenCalledTimes(1);
    });

    test("stopScanning delegates to the native module", () => {
      stopScanning();

      expect(mockNativeModule.stopScanning).toHaveBeenCalledTimes(1);
    });

    test("clearBeacons delegates to the native module", () => {
      clearBeacons();

      expect(mockNativeModule.clearBeacons).toHaveBeenCalledTimes(1);
    });

    test("connect sends arguments through and resolves native response", async () => {
      const macAddress = "AA:BB:CC:DD:EE";
      const password = "123456";
      const timeout = 15;

      const result = await connect(macAddress, password, timeout);

      expect(mockNativeModule.connect).toHaveBeenCalledWith(
        macAddress,
        password,
        timeout,
      );
      expect(result).toBe(true);
    });

    test("connectEnhanced forwards connection parameters", async () => {
      const connPara: KBConnPara = { syncUtcTime: true };

      await connectEnhanced("AA:BB", "pwd", 30, connPara);

      expect(mockNativeModule.connectEnhanced).toHaveBeenCalledWith(
        "AA:BB",
        "pwd",
        30,
        connPara,
      );
    });

    test("disconnect delegates to the native module", async () => {
      await disconnect("AA:BB");

      expect(mockNativeModule.disconnect).toHaveBeenCalledWith("AA:BB");
    });

    test("modifyConfig sends the provided configuration array", async () => {
      const configs: KBCfgBase[] = [{}, {}];

      await modifyConfig("AA:BB", configs);

      expect(mockNativeModule.modifyConfig).toHaveBeenCalledWith(
        "AA:BB",
        configs,
      );
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

    test("readSensorHistory forwards pagination arguments", async () => {
      await readSensorHistory("AA:BB", KBSensorType.PIR, 50, 10);

      expect(mockNativeModule.readSensorHistory).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.PIR,
        50,
        10,
      );
    });

    test("clearSensorHistory delegates to the native bridge", async () => {
      await clearSensorHistory("AA:BB", KBSensorType.Light);

      expect(mockNativeModule.clearSensorHistory).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.Light,
      );
    });

    test("subscribeSensorDataNotify delegates to the native bridge", async () => {
      await subscribeSensorDataNotify("AA:BB", KBSensorType.VOC);

      expect(mockNativeModule.subscribeSensorDataNotify).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.VOC,
      );
    });

    test("unsubscribeSensorDataNotify delegates to the native bridge", async () => {
      await unsubscribeSensorDataNotify("AA:BB", KBSensorType.Alarm);

      expect(mockNativeModule.unsubscribeSensorDataNotify).toHaveBeenCalledWith(
        "AA:BB",
        KBSensorType.Alarm,
      );
    });
  });
});
