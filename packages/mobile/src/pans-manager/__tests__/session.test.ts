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
    writePersistedPosition: jest.fn(),
    ...overrides,
  } as PansNativeGateway;
}

describe("PansDeviceSessionManager", () => {
  test("deduplicates simultaneous opens and disconnects after the final lease", async () => {
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
    const secondPromise = manager.openLiveSession("device");
    await Promise.resolve();
    expect(connect).toHaveBeenCalledTimes(1);
    resolve(true);
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    await first.close();
    expect(native.disconnect).not.toHaveBeenCalled();
    await second.close();
    expect(native.disconnect).toHaveBeenCalledTimes(1);
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
