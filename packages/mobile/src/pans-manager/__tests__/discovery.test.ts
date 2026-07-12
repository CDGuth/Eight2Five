import type { PansBleDevice } from "expo-pans-ble-api";
import type { PansDiscoveryGateway } from "../PansDiscoveryService";
import { PansDiscoveryService } from "../PansDiscoveryService";

jest.mock("expo-pans-ble-api", () => ({}));

describe("PansDiscoveryService", () => {
  test("deduplicates events, computes stale state, and clears native and local snapshots", async () => {
    let discovered!: (event: { devices: PansBleDevice[] }) => void;
    let now = 1_000;
    const gateway: PansDiscoveryGateway = {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: jest.fn(),
      startScanning: jest.fn(async () => undefined),
      stopScanning: jest.fn(),
      clearDevices: jest.fn(),
      addDeviceDiscoveredListener: (listener) => {
        discovered = listener;
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
  });
});
