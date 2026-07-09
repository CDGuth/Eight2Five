import { act, renderHook } from "@testing-library/react-native";
import { useBeaconScanner } from "../useBeaconScanner";
import { APP_NAMESPACE } from "../../types/BeaconProtocol";
import {
  startScanning,
  stopScanning,
  addBeaconDiscoveredListener,
  KBAdvType,
} from "expo-kbeaconpro";
import { BeaconSource } from "../../providers";
import { startScanning as startPansScanning } from "expo-pans-ble-api";

let mockListener: ((event: { beacons: any[] }) => void) | null = null;

const mockRemove = jest.fn();

jest.mock("expo-kbeaconpro", () => {
  const startScanning = jest.fn(async () => undefined);
  const stopScanning = jest.fn();
  const addBeaconDiscoveredListener = jest.fn((listener: any) => {
    mockListener = listener;
    return { remove: mockRemove };
  });

  return {
    KBAdvType: {
      IBeacon: 0,
      EddyTLM: 1,
      EddyUID: 2,
      EddyURL: 3,
      Sensor: 4,
      System: 5,
      EBeacon: 6,
      Unknown: 255,
    },
    startScanning,
    stopScanning,
    addBeaconDiscoveredListener,
  };
});

jest.mock("expo-pans-ble-api", () => ({
  addConnectionStateChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  addDeviceDiscoveredListener: jest.fn(() => ({ remove: jest.fn() })),
  addLocationDataListener: jest.fn(() => ({ remove: jest.fn() })),
  connect: jest.fn(async () => false),
  disconnect: jest.fn(async () => true),
  PANS_BLE_UUIDS: {
    characteristics: {
      locationData: "00000000-0000-0000-0000-000000000000",
    },
  },
  patchOperationMode: jest.fn(async () => undefined),
  readLocationData: jest.fn(async () => new Uint8Array()),
  subscribeLocationData: jest.fn(async () => true),
  unsubscribeLocationData: jest.fn(async () => true),
  writeLocationDataMode: jest.fn(async () => true),
  startScanning: jest.fn(async () => undefined),
  stopScanning: jest.fn(),
}));

const MAX_UINT32 = 4294967295;

function asciiToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "0x" + hex.toUpperCase();
}

function encodePercent(percent: number): number {
  return Math.round((percent / 100) * MAX_UINT32);
}

function numberToHex(value: number, bytes: number): string {
  return (value >>> 0).toString(16).padStart(bytes * 2, "0");
}

function buildIdentityPacket(flags: number, txPower: number) {
  const sidBytes = [0x01, flags, txPower & 0xff, 0x00, 0x00, 0x00];
  return {
    nid: asciiToHex(APP_NAMESPACE),
    sid: "0x" + sidBytes.map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
}

function buildPositionPacket(xPercent: number, yPercent: number, zCm: number) {
  const xHex = numberToHex(encodePercent(xPercent), 4);
  const yHex = numberToHex(encodePercent(yPercent), 4);
  const zHex = ((zCm < 0 ? zCm & 0xffff : zCm) & 0xffff)
    .toString(16)
    .padStart(4, "0");
  return {
    nid: "0x" + xHex + yHex + zHex,
    sid: "0x020000000000",
  };
}

async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useBeaconScanner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (startScanning as jest.Mock).mockResolvedValue(undefined);
    (startPansScanning as jest.Mock).mockResolvedValue(undefined);
    mockListener = null;
    mockRemove.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("starts scanning on mount and stops on unmount", async () => {
    const { unmount } = renderHook(() =>
      useBeaconScanner({ sourceKind: "kbeacon" }),
    );
    await flushAsyncEffects();

    expect(startScanning).toHaveBeenCalledTimes(1);
    expect(addBeaconDiscoveredListener).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(stopScanning).toHaveBeenCalledTimes(1);
  });

  it("awaits source startup before subscribing", async () => {
    let resolveStart: (() => void) | null = null;
    const source: BeaconSource = {
      start: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveStart = resolve;
          }),
      ),
      stop: jest.fn(),
      subscribe: jest.fn(() => ({ remove: jest.fn() })),
    };

    const { unmount } = renderHook(() => useBeaconScanner({ source }));
    await flushAsyncEffects();

    expect(source.start).toHaveBeenCalledTimes(1);
    expect(source.subscribe).not.toHaveBeenCalled();

    resolveStart!();
    await flushAsyncEffects();

    expect(source.subscribe).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("catches rejected source startup", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const source: BeaconSource = {
      start: jest.fn(async () => {
        throw new Error("scan failed");
      }),
      stop: jest.fn(),
      subscribe: jest.fn(() => ({ remove: jest.fn() })),
    };

    const { result, unmount } = renderHook(() => useBeaconScanner({ source }));
    await flushAsyncEffects();

    expect(source.subscribe).not.toHaveBeenCalled();
    expect(result.current.startupError).toEqual(expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to start scanning:",
      expect.any(Error),
    );

    unmount();
    consoleSpy.mockRestore();
  });

  it("surfaces rejected auto source startup when all providers fail", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    (startScanning as jest.Mock).mockRejectedValueOnce(
      new Error("kbeacon failed"),
    );
    (startPansScanning as jest.Mock).mockRejectedValueOnce(
      new Error("pans failed"),
    );

    const { result, unmount } = renderHook(() =>
      useBeaconScanner({ sourceKind: "auto" }),
    );
    await flushAsyncEffects();

    expect(result.current.startupError).toEqual(expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to start scanning:",
      expect.any(Error),
    );

    unmount();
    consoleSpy.mockRestore();
  });

  it("does not surface an auto startup error when one provider starts", async () => {
    (startScanning as jest.Mock).mockRejectedValueOnce(
      new Error("kbeacon failed"),
    );
    (startPansScanning as jest.Mock).mockResolvedValueOnce(undefined);

    const { result, unmount } = renderHook(() =>
      useBeaconScanner({ sourceKind: "auto" }),
    );
    await flushAsyncEffects();

    expect(result.current.startupError).toBeUndefined();

    unmount();
  });

  it("updates beacon map when discovery events fire", async () => {
    const { result, unmount } = renderHook(() =>
      useBeaconScanner({ sourceKind: "kbeacon" }),
    );
    await flushAsyncEffects();

    expect(mockListener).toBeTruthy();

    const identity = buildIdentityPacket(0x07, -60);
    const position = buildPositionPacket(10, 90, 123);

    await act(async () => {
      mockListener?.({
        beacons: [
          {
            mac: "AA:BB:CC:DD:EE:FF",
            rssi: -65,
            advPackets: [
              { advType: KBAdvType.EddyUID, ...identity },
              { advType: KBAdvType.EddyUID, ...position },
            ],
          },
        ],
      });
    });

    const entry = result.current.beacons.get("AA:BB:CC:DD:EE:FF");
    expect(entry).toBeDefined();
    expect(entry?.identity?.flags.isConfigured).toBe(true);
    expect(entry?.position?.xPercent).toBeCloseTo(10, 5);
    expect(entry?.position?.yPercent).toBeCloseTo(90, 5);
    expect(entry?.position?.zCm).toBe(123);

    unmount();
  });
});
