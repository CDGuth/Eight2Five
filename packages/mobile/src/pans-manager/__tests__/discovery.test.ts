import type { PansApiError, PansBleDevice } from "expo-pans-ble-api";
import type { PansDiscoveryGateway } from "../PansDiscoveryService";
import { PansDiscoveryService } from "../PansDiscoveryService";

jest.mock("expo-pans-ble-api", () => ({}));

describe("PansDiscoveryService", () => {
  test("deduplicates events, computes stale state, and clears native and local snapshots", async () => {
    let discovered!: (event: { devices: PansBleDevice[] }) => void;
    let scanError!: (error: PansApiError) => void;
    let now = 1_000;
    const gateway: PansDiscoveryGateway = {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: jest.fn(),
      startScanning: jest.fn(async () => undefined),
      stopScanning: jest.fn(),
      clearDevices: jest.fn(),
      getScanDiagnostics: () => ({
        state: "scanning",
        buildId: "test-build",
        scanSessionId: 1,
        rawResultCount: 1,
        pansResultCount: 1,
        parsedServiceDataHitCount: 1,
        rawAdvertisementHitCount: 0,
        rejectedResultCount: 0,
        startedAtMs: 1_000,
      }),
      addDeviceDiscoveredListener: (listener) => {
        discovered = listener;
        return { remove: jest.fn() };
      },
      addErrorListener: (listener) => {
        scanError = listener;
        return { remove: jest.fn() };
      },
    };
    const service = new PansDiscoveryService(gateway, {
      staleAfterMs: 100,
      now: () => now,
    });
    const listener = jest.fn();
    service.subscribe(listener);
    await service.start();
    const device = {
      deviceId: "ios-id",
      rssi: -50,
      lastSeenMs: 1_000,
      presence: {
        rawOperationModeByte: 0,
        rawUwbModeBits: 0,
        role: "tag",
        errorIndicated: false,
        initiator: false,
        bridge: false,
        uwbMode: "off",
        changeCounter: 0,
      },
    } satisfies PansBleDevice;
    discovered({ devices: [device] });
    discovered({ devices: [device] });
    expect(listener).toHaveBeenCalledTimes(2);
    now = 1_101;
    expect(service.getSnapshots()[0]).toMatchObject({
      transportDeviceId: "ios-id",
      compatibility: "compatible",
      rssi: -50,
      lastSeenAt: 1_000,
      stale: true,
    });
    service.clear();
    expect(gateway.clearDevices).toHaveBeenCalled();
    expect(service.getSnapshots()).toEqual([]);
    expect(scanError).toBeDefined();
    await service.stop();
  });

  test("surfaces asynchronous scan failures and stops discovery state", async () => {
    let scanError!: (error: PansApiError) => void;
    const gateway: PansDiscoveryGateway = {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: jest.fn(),
      startScanning: jest.fn(async () => undefined),
      stopScanning: jest.fn(),
      clearDevices: jest.fn(),
      getScanDiagnostics: () => ({
        state: "failed",
        buildId: "test-build",
        scanSessionId: 1,
        rawResultCount: 0,
        pansResultCount: 0,
        parsedServiceDataHitCount: 0,
        rawAdvertisementHitCount: 0,
        rejectedResultCount: 0,
        lastError: {
          code: "OPERATION_FAILED",
          message: "BLE scan failed with code 6",
          nativeCode: 6,
        },
      }),
      addDeviceDiscoveredListener: () => ({ remove: jest.fn() }),
      addErrorListener: (listener) => {
        scanError = listener;
        return { remove: jest.fn() };
      },
    };
    const service = new PansDiscoveryService(gateway);
    const errorListener = jest.fn();
    service.subscribeErrors(errorListener);

    await service.start();
    scanError({
      code: "OPERATION_FAILED",
      message: "BLE scan failed with code 6",
      nativeCode: 6,
    });

    expect(service.isScanning).toBe(false);
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "BLE scan failed with code 6",
        operation: "discovery",
      }),
    );
    expect(service.getDiagnostics().lastError?.nativeCode).toBe(6);
  });

  test("continues scanning beyond the former 25-second timeout and restarts immediately", async () => {
    jest.useFakeTimers();
    const gateway: PansDiscoveryGateway = {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: jest.fn(),
      startScanning: jest.fn(async () => undefined),
      stopScanning: jest.fn(),
      clearDevices: jest.fn(),
      getScanDiagnostics: () => ({
        state: "scanning",
        buildId: "test-build",
        scanSessionId: 1,
        rawResultCount: 0,
        pansResultCount: 0,
        parsedServiceDataHitCount: 0,
        rawAdvertisementHitCount: 0,
        rejectedResultCount: 0,
        startedAtMs: 1_000,
      }),
      addDeviceDiscoveredListener: () => ({ remove: jest.fn() }),
      addErrorListener: () => ({ remove: jest.fn() }),
    };
    const service = new PansDiscoveryService(gateway, {
      diagnosticsPollIntervalMs: 1_000,
    });

    try {
      await service.start();
      jest.advanceTimersByTime(30_000);
      expect(service.isScanning).toBe(true);
      expect(gateway.stopScanning).not.toHaveBeenCalled();

      await service.stop();
      await service.start();
      expect(gateway.startScanning).toHaveBeenCalledTimes(2);
      expect(gateway.stopScanning).toHaveBeenCalledTimes(1);
      await service.stop();
    } finally {
      jest.useRealTimers();
    }
  });

  test("coalesces rapid alternating requests and converges on final intent", async () => {
    const gateway = discoveryGateway();
    const service = new PansDiscoveryService(gateway);

    const requests: Promise<void>[] = [];
    for (let index = 0; index < 10; index += 1) {
      requests.push(index % 2 === 0 ? service.start() : service.stop());
    }
    await Promise.all(requests);

    expect(service.desiredScanning).toBe(false);
    expect(service.state).toBe("idle");
    expect(gateway.startScanning).toHaveBeenCalledTimes(1);
    expect(gateway.stopScanning).toHaveBeenCalledTimes(1);
  });

  test("a pending native start cannot reactivate a stopped scan", async () => {
    const deferred = createDeferred<void>();
    const gateway = discoveryGateway({
      startScanning: jest.fn(() => deferred.promise),
    });
    const service = new PansDiscoveryService(gateway);
    const states: string[] = [];
    service.subscribeState((state) => states.push(state));

    const start = service.start();
    await Promise.resolve();
    const stop = service.stop();
    deferred.resolve();
    await Promise.all([start, stop]);

    expect(service.desiredScanning).toBe(false);
    expect(service.state).toBe("idle");
    expect(gateway.stopScanning).toHaveBeenCalledTimes(1);
    expect(states).toEqual([
      "idle",
      "starting",
      "scanning",
      "stopping",
      "idle",
    ]);
  });

  test("synchronizes service state when native scanning stops for GATT", async () => {
    jest.useFakeTimers();
    let state: "scanning" | "stopped" = "scanning";
    const gateway: PansDiscoveryGateway = {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: jest.fn(),
      startScanning: jest.fn(async () => undefined),
      stopScanning: jest.fn(),
      clearDevices: jest.fn(),
      getScanDiagnostics: () => ({
        state,
        buildId: "test-build",
        scanSessionId: 1,
        rawResultCount: 1,
        pansResultCount: 1,
        parsedServiceDataHitCount: 1,
        rawAdvertisementHitCount: 0,
        rejectedResultCount: 0,
      }),
      addDeviceDiscoveredListener: () => ({ remove: jest.fn() }),
      addErrorListener: () => ({ remove: jest.fn() }),
    };
    const service = new PansDiscoveryService(gateway, {
      diagnosticsPollIntervalMs: 100,
    });

    try {
      await service.start();
      state = "stopped";
      jest.advanceTimersByTime(100);

      expect(service.isScanning).toBe(false);
      expect(gateway.stopScanning).not.toHaveBeenCalled();
    } finally {
      await service.stop();
      jest.useRealTimers();
    }
  });
});

function discoveryGateway(
  overrides: Partial<PansDiscoveryGateway> = {},
): PansDiscoveryGateway {
  return {
    getPermissionStatus: () => ({ bluetooth: "granted" }),
    requestPermissions: jest.fn(async () => ({
      bluetooth: "granted" as const,
    })),
    startScanning: jest.fn(async () => undefined),
    stopScanning: jest.fn(),
    clearDevices: jest.fn(),
    getScanDiagnostics: () => ({
      state: "scanning",
      buildId: "test-build",
      scanSessionId: 1,
      rawResultCount: 1,
      pansResultCount: 1,
      parsedServiceDataHitCount: 1,
      rawAdvertisementHitCount: 0,
      rejectedResultCount: 0,
      startedAtMs: 1,
    }),
    addDeviceDiscoveredListener: () => ({ remove: jest.fn() }),
    addErrorListener: () => ({ remove: jest.fn() }),
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
