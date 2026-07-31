import type { PansApiError, PansBleDevice } from "expo-pans-ble-api";
import type { PansDiscoveryGateway } from "../PansDiscoveryService";
import {
  DEFAULT_PANS_DISCOVERY_PUBLICATION_INTERVAL_MS,
  PansDiscoveryService,
} from "../PansDiscoveryService";

jest.mock("expo-pans-ble-api", () => ({}));

describe("PansDiscoveryService", () => {
  test("coalesces telemetry to 5 Hz while retaining the exact latest snapshot", () => {
    jest.useFakeTimers();
    let now = 1_000;
    const service = new PansDiscoveryService(discoveryGateway(), {
      now: () => now,
      staleAfterMs: 10_000,
    });
    const listener = jest.fn();
    service.subscribe(listener);

    try {
      service.receiveDevices([device({ rssi: -50, lastSeenMs: 1_000 })]);
      expect(listener).toHaveBeenCalledTimes(2);

      now = 1_050;
      service.receiveDevices([device({ rssi: -51, lastSeenMs: 1_050 })]);
      now = 1_100;
      service.receiveDevices([device({ rssi: -52, lastSeenMs: 1_100 })]);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(service.getSnapshots()[0]).toMatchObject({
        rssi: -52,
        lastSeenAt: 1_100,
      });

      jest.advanceTimersByTime(
        DEFAULT_PANS_DISCOVERY_PUBLICATION_INTERVAL_MS - 51,
      );
      expect(listener).toHaveBeenCalledTimes(2);
      now = 1_200;
      jest.advanceTimersByTime(1);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener.mock.calls[2]?.[0]?.[0]).toMatchObject({
        rssi: -52,
        lastSeenAt: 1_100,
      });
    } finally {
      service.clear();
      jest.useRealTimers();
    }
  });

  test("publishes presence semantics immediately and cancels pending telemetry", () => {
    jest.useFakeTimers();
    let now = 1_000;
    const service = new PansDiscoveryService(discoveryGateway(), {
      now: () => now,
      staleAfterMs: 10_000,
    });
    const listener = jest.fn();
    service.subscribe(listener);

    try {
      service.receiveDevices([device()]);
      now = 1_050;
      service.receiveDevices([device({ rssi: -60, lastSeenMs: 1_050 })]);
      now = 1_060;
      service.receiveDevices([
        device({
          rssi: -61,
          lastSeenMs: 1_060,
          presence: { ...presence(), raw: [1, 2], changeCounter: 1 },
        }),
      ]);

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener.mock.calls[2]?.[0]?.[0]).toMatchObject({
        rssi: -61,
        presence: { raw: [1, 2], changeCounter: 1 },
      });
      jest.advanceTimersByTime(DEFAULT_PANS_DISCOVERY_PUBLICATION_INTERVAL_MS);
      expect(listener).toHaveBeenCalledTimes(3);
    } finally {
      service.clear();
      jest.useRealTimers();
    }
  });

  test("publishes fresh-to-stale on its deadline and stale-to-fresh immediately", () => {
    jest.useFakeTimers();
    let now = 1_000;
    const service = new PansDiscoveryService(discoveryGateway(), {
      now: () => now,
      staleAfterMs: 100,
    });
    const listener = jest.fn();
    service.subscribe(listener);

    try {
      service.receiveDevices([device()]);
      now = 1_100;
      jest.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener.mock.calls[2]?.[0]?.[0]?.stale).toBe(true);

      service.receiveDevices([device({ lastSeenMs: 1_100 })]);
      expect(listener).toHaveBeenCalledTimes(4);
      expect(listener.mock.calls[3]?.[0]?.[0]?.stale).toBe(false);
    } finally {
      service.clear();
      jest.useRealTimers();
    }
  });

  test("suppresses identical and raw-only events without JSON serialization", () => {
    jest.useFakeTimers();
    const service = new PansDiscoveryService(discoveryGateway(), {
      now: () => 1_000,
      staleAfterMs: 10_000,
    });
    const listener = jest.fn();
    service.subscribe(listener);
    const stringify = jest.spyOn(JSON, "stringify").mockImplementation(() => {
      throw new Error("JSON serialization must not be used by discovery");
    });

    try {
      service.receiveDevices([device()]);
      service.receiveDevices([device()]);
      service.receiveDevices([
        { ...device(), diagnosticOnly: "latest" } as PansBleDevice,
      ]);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(
        (
          service.getSnapshots()[0]?.rawDevice as PansBleDevice & {
            diagnosticOnly?: string;
          }
        )?.diagnosticOnly,
      ).toBe("latest");
    } finally {
      stringify.mockRestore();
      service.clear();
      jest.useRealTimers();
    }
  });

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
    const discoveryListener = jest.fn();
    service.subscribeErrors(errorListener);
    service.subscribe(discoveryListener);

    await service.start();
    const publicationsBeforeError = discoveryListener.mock.calls.length;
    scanError({
      code: "OPERATION_FAILED",
      message: "BLE scan failed with code 6",
      nativeCode: 6,
    });

    expect(service.isScanning).toBe(false);
    expect(discoveryListener).toHaveBeenCalledTimes(
      publicationsBeforeError + 1,
    );
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

function presence(): NonNullable<PansBleDevice["presence"]> {
  return {
    rawOperationModeByte: 0,
    rawUwbModeBits: 0,
    role: "tag",
    errorIndicated: false,
    initiator: false,
    bridge: false,
    uwbMode: "off",
    changeCounter: 0,
  };
}

function device(overrides: Partial<PansBleDevice> = {}): PansBleDevice {
  return {
    deviceId: "device-1",
    rssi: -50,
    lastSeenMs: 1_000,
    presence: presence(),
    ...overrides,
  };
}
