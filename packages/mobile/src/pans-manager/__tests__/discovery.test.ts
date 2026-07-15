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
    service.stop();
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

  test("stops a bounded scan and rejects an immediate restart", async () => {
    jest.useFakeTimers();
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
      now: () => now,
      scanDurationMs: 100,
      restartCooldownMs: 50,
    });

    try {
      await service.start();
      now = 1_100;
      jest.advanceTimersByTime(100);

      expect(service.isScanning).toBe(false);
      expect(gateway.stopScanning).toHaveBeenCalledTimes(1);
      await expect(service.start()).rejects.toMatchObject({
        code: "SCAN_THROTTLED",
      });

      now = 1_150;
      await service.start();
      expect(gateway.startScanning).toHaveBeenCalledTimes(2);
      service.stop();
    } finally {
      jest.useRealTimers();
    }
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
      service.stop();
      jest.useRealTimers();
    }
  });
});
