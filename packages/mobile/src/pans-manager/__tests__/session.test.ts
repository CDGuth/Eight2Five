import type { PansNativeGateway } from "../PansDeviceSessionManager";
import { PansDeviceSessionManager } from "../PansDeviceSessionManager";

jest.mock("expo-pans-ble-api", () => ({}));

function gateway(
  overrides: Partial<PansNativeGateway> = {},
): PansNativeGateway {
  return {
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => true),
    readLabel: jest.fn(),
    writeLabel: jest.fn(),
    readNetworkId: jest.fn(),
    writeNetworkId: jest.fn(),
    readOperationMode: jest.fn(),
    patchOperationMode: jest.fn(),
    readLocationDataMode: jest.fn(),
    writeLocationDataMode: jest.fn(),
    readTagUpdateRate: jest.fn(),
    readDeviceInfo: jest.fn(),
    readAnchorList: jest.fn(),
    readClusterInfo: jest.fn(),
    readStatistics: jest.fn(),
    readAnchorMacStats: jest.fn(),
    readLocationData: jest.fn(),
    subscribeLocationData: jest.fn(),
    unsubscribeLocationData: jest.fn(),
    addLocationDataListener: jest.fn(() => ({ remove: jest.fn() })),
    decodeLocationData: jest.fn(),
    writePersistedPosition: jest.fn(),
    ...overrides,
  } as PansNativeGateway;
}

describe("PansDeviceSessionManager", () => {
  test("reserves exactly one live session while its connection opens", async () => {
    let resolve!: (connected: boolean) => void;
    const connect = jest.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const native = gateway({ connect });
    const manager = new PansDeviceSessionManager(native);
    const firstPromise = manager.openLiveSession("device");
    await expect(manager.openLiveSession("device")).rejects.toMatchObject({
      code: "GATT_FAILURE",
      isRetryable: true,
    });
    await Promise.resolve();
    expect(connect).toHaveBeenCalledTimes(1);
    resolve(true);
    const first = await firstPromise;
    await first.close();
    expect(native.disconnect).toHaveBeenCalledTimes(1);
  });

  test("rejects configuration during a live lease without disconnecting it", async () => {
    const native = gateway();
    const manager = new PansDeviceSessionManager(native);
    const live = await manager.openLiveSession("tag");

    await expect(
      manager.withConnectedDevice("anchor", async () => undefined),
    ).rejects.toMatchObject({ code: "GATT_FAILURE", isRetryable: true });
    expect(native.connect).toHaveBeenCalledTimes(1);
    expect(native.disconnect).not.toHaveBeenCalled();

    await live.close();
    await manager.withConnectedDevice("anchor", async () => undefined);
    expect(native.disconnect).toHaveBeenCalledTimes(2);
  });

  test("rejects a live open while a queued mutation owns the manager", async () => {
    let finish!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const manager = new PansDeviceSessionManager(gateway());
    const mutation = manager.withConnectedDevice(
      "anchor",
      async () =>
        await new Promise<void>((resolve) => {
          finish = resolve;
          markStarted();
        }),
    );
    await started;

    await expect(manager.openLiveSession("tag")).rejects.toMatchObject({
      code: "GATT_FAILURE",
    });
    finish();
    await mutation;
  });

  test("serializes global mutation transactions and guarantees cleanup", async () => {
    const order: string[] = [];
    const native = gateway({
      connect: jest.fn(async (id) => {
        order.push(`connect:${id}`);
        return true;
      }),
      disconnect: jest.fn(async (id) => {
        order.push(`disconnect:${id}`);
        return true;
      }),
    });
    const manager = new PansDeviceSessionManager(native);
    const first = manager.withConnectedDevice("a", async (session) => {
      expect(session.transportDeviceId).toBe("a");
      expect("gateway" in session).toBe(false);
      order.push("run:a");
      throw new Error("boom");
    });
    const second = manager.withConnectedDevice("b", async () => {
      order.push("run:b");
    });
    await expect(first).rejects.toMatchObject({ code: "UNKNOWN" });
    await second;
    expect(order).toEqual([
      "connect:a",
      "run:a",
      "disconnect:a",
      "connect:b",
      "run:b",
      "disconnect:b",
    ]);
  });
});
