import { createPansBleSource } from "../PansBleSource";

type Listener<T> = (event: T) => void;

let discoveryListener: Listener<{ devices: PansDevice[] }> | undefined;
let locationListener:
  | Listener<{
      deviceId: string;
      characteristicUuid: string;
      payload: number[];
    }>
  | undefined;

interface PansDevice {
  deviceId: string;
  rssi: number;
  lastSeenMs: number;
  presence?: { role: "tag" | "anchor"; uwbMode?: "off" | "passive" | "active" };
}

jest.mock("expo-pans-ble-api", () => ({
  PANS_BLE_UUIDS: {
    characteristics: {
      locationData: "003bbdf2-c634-4b3d-ab56-7ec889b89a37",
      proxyPositions: "f4a67d7d-379d-4183-9c03-4b6ea5103291",
    },
  },
  startScanning: jest.fn(async () => undefined),
  stopScanning: jest.fn(),
  connect: jest.fn(async () => true),
  disconnect: jest.fn(async () => true),
  patchOperationMode: jest.fn(async () => ({ raw: [0, 0] })),
  writeLocationDataMode: jest.fn(async () => true),
  subscribeLocationData: jest.fn(async () => true),
  unsubscribeLocationData: jest.fn(async () => true),
  readLocationData: jest.fn(async () => ({
    distances: [],
    raw: [],
    diagnostics: [],
  })),
  decodeLocationData: jest.fn((payload: number[]) => {
    if (payload[0] !== 0)
      return { distances: [], raw: payload, diagnostics: [] };
    const bytes = Uint8Array.from(payload);
    const view = new DataView(bytes.buffer);
    return {
      frameType: 0,
      position: {
        xMeters: view.getInt32(1, true) / 1000,
        yMeters: view.getInt32(5, true) / 1000,
        zMeters: view.getInt32(9, true) / 1000,
        quality: payload[13],
      },
      distances: [],
      raw: payload,
      diagnostics: [],
    };
  }),
  addDeviceDiscoveredListener: jest.fn((listener) => {
    discoveryListener = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  addLocationDataListener: jest.fn((listener) => {
    locationListener = listener;
    return { remove: jest.fn() };
  }),
}));

const pans = jest.requireMock("expo-pans-ble-api") as {
  PANS_BLE_UUIDS: { characteristics: Record<string, string> };
  connect: jest.Mock;
  disconnect: jest.Mock;
  patchOperationMode: jest.Mock;
  writeLocationDataMode: jest.Mock;
  subscribeLocationData: jest.Mock;
  unsubscribeLocationData: jest.Mock;
  readLocationData: jest.Mock;
};

describe("PansBleSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    discoveryListener = undefined;
    locationListener = undefined;
    pans.connect.mockResolvedValue(true);
    pans.readLocationData.mockResolvedValue({
      distances: [],
      raw: [],
      diagnostics: [],
    });
  });

  test("ignores anchors and connects one selected tag", async () => {
    const listener = jest.fn();
    createPansBleSource().subscribe(listener);

    discoveryListener?.({
      devices: [
        device("anchor-1", "anchor"),
        device("tag-1", "tag"),
        device("tag-2", "tag"),
      ],
    });

    await flushPromises();

    expect(pans.connect).toHaveBeenCalledTimes(1);
    expect(pans.connect).toHaveBeenCalledWith("tag-1", 10_000);
    expect(pans.patchOperationMode).toHaveBeenCalledWith("tag-1", {
      role: "tag",
      uwbMode: "active",
      locationEngineEnabled: true,
    });
    expect(pans.writeLocationDataMode).toHaveBeenCalledWith("tag-1", 0);
    expect(pans.subscribeLocationData).toHaveBeenCalledWith("tag-1");
  });

  test("honors tagDeviceId, selectTag, and disabled solver mode", async () => {
    createPansBleSource({
      tagDeviceId: "tag-2",
      selectTag: (candidate) => candidate.deviceId === "tag-2",
      useInternalLocationSolver: false,
    }).subscribe(jest.fn());

    discoveryListener?.({
      devices: [device("tag-1", "tag"), device("tag-2", "tag")],
    });
    await flushPromises();

    expect(pans.connect).toHaveBeenCalledWith("tag-2", 10_000);
    expect(pans.writeLocationDataMode).toHaveBeenCalledWith("tag-2", 1);
  });

  test("emits initial calculated coordinates and filters notifications", async () => {
    const listener = jest.fn();
    pans.readLocationData.mockResolvedValueOnce({
      frameType: 0,
      position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 80 },
      distances: [],
      raw: [],
      diagnostics: [],
    });

    createPansBleSource().subscribe(listener);
    discoveryListener?.({ devices: [device("tag-1", "tag")] });
    await flushPromises();

    expect(listener).toHaveBeenCalledWith({
      observations: [
        expect.objectContaining({
          mac: "tag-1",
          positionXMeters: 1,
          positionYMeters: 2,
          positionZMeters: 3,
        }),
      ],
    });

    listener.mockClear();
    locationListener?.({
      deviceId: "tag-2",
      characteristicUuid: pans.PANS_BLE_UUIDS.characteristics.locationData,
      payload: [0, ...i32(1), ...i32(2), ...i32(3), 80],
    });
    locationListener?.({
      deviceId: "tag-1",
      characteristicUuid: pans.PANS_BLE_UUIDS.characteristics.proxyPositions,
      payload: [0],
    });
    expect(listener).not.toHaveBeenCalled();

    locationListener?.({
      deviceId: "tag-1",
      characteristicUuid: pans.PANS_BLE_UUIDS.characteristics.locationData,
      payload: [0, ...i32(1), ...i32(2), ...i32(3), 80],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("cleanup unsubscribes and disconnects by default", async () => {
    const subscription = createPansBleSource().subscribe(jest.fn());
    discoveryListener?.({ devices: [device("tag-1", "tag")] });
    await flushPromises();

    subscription.remove();
    await flushPromises();

    expect(pans.unsubscribeLocationData).toHaveBeenCalledWith("tag-1");
    expect(pans.disconnect).toHaveBeenCalledWith("tag-1");
  });

  test("cleanup can preserve connection and errors are surfaced", async () => {
    const onError = jest.fn();
    const subscription = createPansBleSource({
      disconnectOnTeardown: false,
      onError,
    }).subscribe(() => {
      throw new Error("listener failed");
    });

    discoveryListener?.({ devices: [device("tag-1", "tag")] });
    await flushPromises();
    locationListener?.({
      deviceId: "tag-1",
      characteristicUuid: pans.PANS_BLE_UUIDS.characteristics.locationData,
      payload: [0, ...i32(1), ...i32(2), ...i32(3), 80],
    });

    expect(onError).toHaveBeenCalled();
    subscription.remove();
    await flushPromises();
    expect(pans.disconnect).not.toHaveBeenCalled();
  });
});

function device(deviceId: string, role: "tag" | "anchor"): PansDevice {
  return { deviceId, rssi: -50, lastSeenMs: 1, presence: { role } };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function i32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return Array.from(bytes);
}
