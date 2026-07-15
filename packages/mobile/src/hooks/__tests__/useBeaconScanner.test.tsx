import { act, renderHook } from "@testing-library/react-native";
import { useBeaconScanner } from "../useBeaconScanner";
import { BeaconSource } from "../../providers";
import { startScanning as startPansScanning } from "expo-pans-ble-api";

jest.mock("expo-pans-ble-api", () => ({
  addConnectionStateChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  addDeviceDiscoveredListener: jest.fn(() => ({ remove: jest.fn() })),
  addErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  addLocationDataListener: jest.fn(() => ({ remove: jest.fn() })),
  connect: jest.fn(async () => false),
  disconnect: jest.fn(async () => true),
  requestExplicitDisconnect: jest.fn(async () => true),
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
    (startPansScanning as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("subscribes before source startup can emit events", async () => {
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
    expect(source.subscribe).toHaveBeenCalledTimes(1);

    resolveStart!();
    await flushAsyncEffects();

    unmount();
  });

  it("catches rejected source startup", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const remove = jest.fn();
    const source: BeaconSource = {
      start: jest.fn(async () => {
        throw new Error("scan failed");
      }),
      stop: jest.fn(),
      subscribe: jest.fn(() => ({ remove })),
    };

    const { result, unmount } = renderHook(() => useBeaconScanner({ source }));
    await flushAsyncEffects();

    expect(source.subscribe).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(result.current.startupError).toEqual(expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to start scanning:",
      expect.any(Error),
    );

    unmount();
    consoleSpy.mockRestore();
  });

  it("defaults to the pans-ble source kind", async () => {
    const { unmount } = renderHook(() => useBeaconScanner());
    await flushAsyncEffects();

    expect(startPansScanning).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("ingests distance observations into the localization engine", async () => {
    let listener: ((event: { observations: any[] }) => void) | null = null;
    const remove = jest.fn();
    const source: BeaconSource = {
      start: jest.fn(async () => undefined),
      stop: jest.fn(),
      subscribe: jest.fn((l: any) => {
        listener = l;
        return { remove };
      }),
    };

    const { result, unmount } = renderHook(() => useBeaconScanner({ source }));
    await flushAsyncEffects();

    expect(listener).toBeTruthy();

    await act(async () => {
      listener?.({
        observations: [
          {
            mac: "uwb-anchor-cdef",
            observedAtMs: Date.now(),
            source: "pans-ble-uwb",
            measurementKind: "distance",
            distanceMeters: 4.25,
            quality: 91,
          },
        ],
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.beacons).toHaveLength(1);
    expect(result.current.beacons[0]).toMatchObject({
      mac: "uwb-anchor-cdef",
      distanceMeters: 4.25,
      measurementKind: "distance",
    });

    unmount();
  });
});
