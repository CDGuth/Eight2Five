import {
  addConnectionStateChangedListener,
  addDeviceDiscoveredListener,
  addErrorListener,
  addNotificationReceivedListener,
  clearDevices,
  connect,
  disconnect,
  executeCommand,
  getCapabilities,
  pushFwUpdatePayload,
  readAnchorList,
  readLocationData,
  readOperationMode,
  readProxyPositions,
  setTagLocationEngineEnabled,
  startScanning,
  stopScanning,
  writeLocationDataMode,
  writeOperationMode,
  writePersistedPosition,
} from "../src/ExpoPansBleApiModule";
import {
  ExpoPansBleApiModuleEvents,
  PansApiCapabilities,
  PansCommandResult,
  PansCommandType,
} from "../src/ExpoPansBleApi.types";

type NativeModuleMock = {
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  clearDevices: jest.Mock;
  getCapabilities: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  executeCommand: jest.Mock;
};

const defaultCommandResult: PansCommandResult = {
  ok: true,
  response: { type: 0x90, value: [1, 2], transport: "ble" },
};

jest.mock("expo-modules-core", () => {
  const mockSubscription = { remove: jest.fn() };
  const mockAddListener = jest.fn().mockReturnValue(mockSubscription);

  const mockCapabilities: PansApiCapabilities = {
    transport: "ble",
    commandMode: "tlv",
    supportsScanning: true,
    supportsConnection: true,
    supportsNotifications: true,
    supportedCommands: [0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0xa0],
  };

  const mockNativeModule: NativeModuleMock = {
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    clearDevices: jest.fn(),
    getCapabilities: jest.fn(() => mockCapabilities),
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    executeCommand: jest.fn(async () => defaultCommandResult),
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

function resetMocks(): void {
  jest.clearAllMocks();
  Object.values(mockNativeModule).forEach((mockFn) => {
    if (typeof mockFn === "function") {
      mockFn.mockClear();
    }
  });

  mockAddListener.mockClear();
  mockAddListener.mockReturnValue(mockSubscription);
  mockSubscription.remove.mockClear();

  mockNativeModule.connect.mockResolvedValue(true);
  mockNativeModule.disconnect.mockResolvedValue(true);
  mockNativeModule.executeCommand.mockResolvedValue(defaultCommandResult);
}

describe("ExpoPansBleApiModule", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("event listeners", () => {
    test("wires device discovered listener", () => {
      const listener = jest.fn();

      const subscription = addDeviceDiscoveredListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoPansBleApiModuleEvents.onDeviceDiscovered,
        listener,
      );
      expect(subscription).toBe(mockSubscription);
    });

    test("wires connection state listener", () => {
      const listener = jest.fn();

      addConnectionStateChangedListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoPansBleApiModuleEvents.onConnectionStateChanged,
        listener,
      );
    });

    test("wires notification listener", () => {
      const listener = jest.fn();

      addNotificationReceivedListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoPansBleApiModuleEvents.onNotificationReceived,
        listener,
      );
    });

    test("wires error listener", () => {
      const listener = jest.fn();

      addErrorListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith(
        ExpoPansBleApiModuleEvents.onError,
        listener,
      );
    });
  });

  describe("bridge delegation", () => {
    test("delegates scan controls", () => {
      startScanning();
      stopScanning();
      clearDevices();

      expect(mockNativeModule.startScanning).toHaveBeenCalledTimes(1);
      expect(mockNativeModule.stopScanning).toHaveBeenCalledTimes(1);
      expect(mockNativeModule.clearDevices).toHaveBeenCalledTimes(1);
    });

    test("returns capabilities from native module", () => {
      const capabilities = getCapabilities();

      expect(mockNativeModule.getCapabilities).toHaveBeenCalledTimes(1);
      expect(capabilities.transport).toBe("ble");
      expect(capabilities.commandMode).toBe("tlv");
    });
  });

  describe("input validation", () => {
    test("connect validates MAC or iOS UUID", async () => {
      await connect("AA:BB:CC:DD:EE:FF", 5000);
      await connect("a4cb2be6-a127-4f98-bf8d-b91ffc9030d9", 5000);

      expect(mockNativeModule.connect).toHaveBeenCalledTimes(2);
    });

    test("connect rejects invalid address", async () => {
      await expect(connect("not-an-address")).rejects.toThrow(
        "INVALID_ARGUMENT",
      );
      expect(mockNativeModule.connect).not.toHaveBeenCalled();
    });

    test("executeCommand rejects invalid TLV type", async () => {
      await expect(
        executeCommand("AA:BB:CC:DD:EE:FF", { type: 999, value: [] }),
      ).rejects.toThrow("TLV type");
      expect(mockNativeModule.executeCommand).not.toHaveBeenCalled();
    });

    test("executeCommand rejects invalid value bytes", async () => {
      await expect(
        executeCommand("AA:BB:CC:DD:EE:FF", { type: 0x90, value: [0, 256] }),
      ).rejects.toThrow("TLV value");
      expect(mockNativeModule.executeCommand).not.toHaveBeenCalled();
    });

    test("writeLocationDataMode validates byte range", async () => {
      await expect(
        writeLocationDataMode("AA:BB:CC:DD:EE:FF", -1),
      ).rejects.toThrow("mode");
      expect(mockNativeModule.executeCommand).not.toHaveBeenCalled();
    });

    test("writeOperationMode validates two-byte tuple", async () => {
      await expect(
        writeOperationMode("AA:BB:CC:DD:EE:FF", [1, 300]),
      ).rejects.toThrow("operation mode");
      expect(mockNativeModule.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe("command helpers", () => {
    test("read helper commands map to expected TLV type", async () => {
      await readLocationData("AA:BB:CC:DD:EE:FF");
      await readProxyPositions("AA:BB:CC:DD:EE:FF");
      await readOperationMode("AA:BB:CC:DD:EE:FF");
      await readAnchorList("AA:BB:CC:DD:EE:FF");

      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        1,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.readLocationData,
          value: [],
        },
      );
      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        2,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.readProxyPositions,
          value: [],
        },
      );
      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        3,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.readOperationMode,
          value: [],
        },
      );
      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        4,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.readAnchorList,
          value: [],
        },
      );
    });

    test("write helpers map payloads to expected TLV requests", async () => {
      await writeOperationMode("AA:BB:CC:DD:EE:FF", [1, 32]);
      await pushFwUpdatePayload("AA:BB:CC:DD:EE:FF", [1, 2, 3]);
      await writePersistedPosition("AA:BB:CC:DD:EE:FF", {
        xMeters: 1.5,
        yMeters: -2.25,
        zMeters: 0.75,
        quality: 80,
      });

      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        1,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.writeOperationMode,
          value: [1, 32],
        },
      );
      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        2,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.fwUpdatePush,
          value: [1, 2, 3],
        },
      );

      const persistedCall = mockNativeModule.executeCommand.mock.calls[2];
      expect(persistedCall[0]).toEqual("AA:BB:CC:DD:EE:FF");
      expect(persistedCall[1].type).toBe(
        PansCommandType.writePersistedPosition,
      );
      expect(persistedCall[1].value).toHaveLength(13);
      expect(persistedCall[1].value[12]).toBe(80);
    });

    test("setTagLocationEngineEnabled propagates read failures", async () => {
      const readFailure: PansCommandResult = {
        ok: false,
        error: { code: "OPERATION_FAILED", message: "read failed" },
      };

      mockNativeModule.executeCommand.mockResolvedValueOnce(readFailure);

      const result = await setTagLocationEngineEnabled(
        "AA:BB:CC:DD:EE:FF",
        true,
      );

      expect(result).toEqual(readFailure);
      expect(mockNativeModule.executeCommand).toHaveBeenCalledTimes(1);
    });

    test("setTagLocationEngineEnabled toggles operation byte bit", async () => {
      mockNativeModule.executeCommand
        .mockResolvedValueOnce({
          ok: true,
          response: {
            type: PansCommandType.readOperationMode,
            value: [0x01, 0x00],
            transport: "ble",
          },
        })
        .mockResolvedValueOnce(defaultCommandResult);

      await setTagLocationEngineEnabled("AA:BB:CC:DD:EE:FF", true);

      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        1,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.readOperationMode,
          value: [],
        },
      );
      expect(mockNativeModule.executeCommand).toHaveBeenNthCalledWith(
        2,
        "AA:BB:CC:DD:EE:FF",
        {
          type: PansCommandType.writeOperationMode,
          value: [0x01, 0x20],
        },
      );
    });

    test("disconnect validates and delegates", async () => {
      await disconnect("AA:BB:CC:DD:EE:FF");

      expect(mockNativeModule.disconnect).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
      );
    });
  });
});
