import { InMemoryPansManagerRepository } from "@eight2five/mobile/pans-manager";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  PansPosition,
  PansPositionStreamSample,
  StartPansPositionStreamOptions,
} from "@eight2five/mobile/pans-manager";
import type { SharedValue } from "react-native-reanimated";
import type { FieldPoint } from "@eight2five/mobile/field";

import type { MobilePansRuntime } from "../mobile-pans-runtime";
import {
  MobilePansStore,
  pansPositionToFieldPoint,
} from "../mobile-pans-store";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock"),
);
jest.mock(
  "@shopify/react-native-skia",
  () => ({
    Canvas: () => null,
    Fill: () => null,
    Group: () => null,
    Path: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
    useFont: () => ({}),
    vec: (x: number, y: number) => ({ x, y }),
  }),
  { virtual: true },
);

const DISCOVERY: DiscoveredDeviceSnapshot = {
  transportDeviceId: "tag-transport",
  name: "Field Tag",
  rssi: -48,
  lastSeenAt: 1,
  stale: false,
  compatibility: "compatible",
  presence: { role: "tag" } as never,
};

describe("MobilePansStore", () => {
  afterEach(() => jest.useRealTimers());

  test("shares one connection attempt and one position stream", async () => {
    const start = deferred<void>();
    const harness = await createHarness({
      streamStart: jest.fn(
        async (_options: StartPansPositionStreamOptions) => await start.promise,
      ),
    });
    const store = new MobilePansStore({
      createRuntime: async () => harness.runtime,
    });
    await store.initialize();
    await store.selectTag(DISCOVERY.transportDeviceId);

    const first = store.connect();
    const second = store.connect();
    await Promise.resolve();
    expect(harness.streamStart).toHaveBeenCalledTimes(1);

    start.resolve();
    await Promise.all([first, second]);
    expect(store.getSnapshot().connectionState).toBe("connected");
    await store.dispose();
  });

  test("cancels bounded reconnect after explicit disconnect", async () => {
    jest.useFakeTimers();
    const remembered = managedTag();
    const streamStart = jest.fn(
      async (_options: StartPansPositionStreamOptions) => {
        throw new Error("offline");
      },
    );
    const harness = await createHarness({ remembered, streamStart });
    const store = new MobilePansStore({
      createRuntime: async () => harness.runtime,
      reconnectDelaysMs: [100, 200],
    });

    await store.initialize();
    await flushPromises();
    expect(streamStart).toHaveBeenCalledTimes(1);
    await store.disconnect();
    jest.advanceTimersByTime(1_000);
    await flushPromises();

    expect(streamStart).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().connectionState).toBe("disconnected");
    await store.dispose();
  });

  test("updates the shared marker immediately and marks old data stale", async () => {
    jest.useFakeTimers();
    const harness = await createHarness();
    const marker = { value: null } as SharedValue<FieldPoint | null>;
    const store = new MobilePansStore({
      createRuntime: async () => harness.runtime,
      staleAfterMs: 500,
    });
    store.attachPositionValue(marker);
    await store.initialize();
    await store.selectTag(DISCOVERY.transportDeviceId);
    await store.connect();

    harness.emitSample(positionSample(1_000, 12.5, 7.25, 1.8));
    expect(marker.value).toEqual({ xMeters: 12.5, yMeters: 7.25 });
    expect(store.getSnapshot()).toMatchObject({
      connectionState: "connected",
      rawPosition: { xMeters: 12.5, yMeters: 7.25, zMeters: 1.8 },
      livePosition: { isStale: false },
    });

    jest.advanceTimersByTime(500);
    expect(marker.value).toBeNull();
    expect(store.getSnapshot().livePosition).toMatchObject({
      position: { xMeters: 12.5, yMeters: 7.25 },
      isStale: true,
    });
    await store.dispose();
  });

  test("forgets persisted identity without deleting the device cache", async () => {
    const harness = await createHarness();
    const store = new MobilePansStore({
      createRuntime: async () => harness.runtime,
    });
    await store.initialize();
    await store.selectTag(DISCOVERY.transportDeviceId);
    const selectedId = store.getSnapshot().rememberedTag?.id;

    await store.forgetTag();

    expect(
      (await harness.repository.getSettings())?.rememberedTagDeviceId,
    ).toBeUndefined();
    expect(await harness.repository.getDevice(selectedId!)).toBeDefined();
    expect(store.getSnapshot().connectionState).toBe("idle");
    await store.dispose();
  });

  test("uses the documented identity-aligned PANS-to-field conversion", () => {
    expect(
      pansPositionToFieldPoint({
        xMeters: -2,
        yMeters: 4,
        zMeters: 1,
        quality: 20,
      }),
    ).toEqual({ xMeters: -2, yMeters: 4 });
  });

  test("writes once with internal quality 100 and caches only successful writes", async () => {
    const harness = await createHarness();
    await harness.repository.saveDevice(managedAnchor("anchor-1"));
    await harness.repository.saveDevice(managedAnchor("anchor-2"));
    const store = new MobilePansStore({
      createRuntime: async () => harness.runtime,
    });
    await store.initialize();
    await store.selectTag(DISCOVERY.transportDeviceId);
    await store.connect();

    const position = { xMeters: 10, yMeters: 20, zMeters: 2 };
    await Promise.all([
      store.writeAnchorPosition("anchor-1", position),
      store.writeAnchorPosition("anchor-1", position),
    ]);

    expect(harness.configurationApply).toHaveBeenCalledTimes(1);
    expect(harness.configurationApply).toHaveBeenCalledWith("anchor-1", {
      position: { ...position, quality: 100 },
    });
    expect(await harness.repository.getDevice("anchor-1")).toMatchObject({
      lastKnownConfig: { position: { ...position, quality: 100 } },
    });

    harness.configurationApply.mockRejectedValueOnce(new Error("write failed"));
    await expect(
      store.writeAnchorPosition("anchor-2", position),
    ).rejects.toBeDefined();
    expect(
      (await harness.repository.getDevice("anchor-2"))?.lastKnownConfig,
    ).not.toHaveProperty("position");
    await store.dispose();
  });
});

async function createHarness(
  options: {
    remembered?: ManagedDevice;
    streamStart?: jest.Mock<Promise<void>, [StartPansPositionStreamOptions]>;
  } = {},
) {
  const repository = new InMemoryPansManagerRepository();
  await repository.initialize();
  if (options.remembered) {
    await repository.saveDevice(options.remembered);
    const settings = await repository.getSettings();
    await repository.saveSettings({
      ...settings!,
      rememberedTagDeviceId: options.remembered.id,
    });
  }
  let streamOptions: StartPansPositionStreamOptions | undefined;
  const streamStart = options.streamStart ?? jest.fn(async () => undefined);
  const configurationApply = jest.fn(
    async (deviceId: string, changes: { position: PansPosition }) => {
      const device = (await repository.getDevice(deviceId))!;
      await repository.saveDevice({
        ...device,
        lastKnownConfig: {
          ...(device.lastKnownConfig?.role === "anchor"
            ? device.lastKnownConfig
            : anchorConfig()),
          position: changes.position,
        },
      });
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: "partial" as const,
        writes: [
          {
            field: "position",
            status: "written-unverified" as const,
            requested: changes.position,
          },
        ],
        warnings: [],
      };
    },
  );
  const runtime = {
    repository,
    discovery: {
      getPermissionStatus: () => ({ bluetooth: "granted" }),
      requestPermissions: async () => ({ bluetooth: "granted" }),
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
      subscribe: (listener: (items: DiscoveredDeviceSnapshot[]) => void) => {
        listener([DISCOVERY]);
        return { remove: jest.fn() };
      },
      subscribeErrors: () => ({ remove: jest.fn() }),
    },
    sessions: {
      addConnectionStateListener: () => ({ remove: jest.fn() }),
      closeAll: jest.fn(async () => undefined),
    },
    stream: {
      start: jest.fn(async (next: StartPansPositionStreamOptions) => {
        streamOptions = next;
        await streamStart(next);
      }),
      stop: jest.fn(async () => undefined),
    },
    configuration: { applyConfigurationDiff: configurationApply },
    diagnostics: {},
    close: jest.fn(async () => undefined),
  } as unknown as MobilePansRuntime;
  return {
    repository,
    runtime,
    streamStart,
    configurationApply,
    emitSample(sample: PansPositionStreamSample) {
      streamOptions?.onSample(sample);
    },
  };
}

function managedAnchor(id: string): ManagedDevice {
  return {
    id,
    transportDeviceId: `transport-${id}`,
    role: "anchor",
    lastKnownConfig: anchorConfig(),
    createdAt: 1,
    updatedAt: 1,
  };
}

function anchorConfig() {
  return {
    role: "anchor" as const,
    uwbMode: "active" as const,
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    initiatorEnabled: false,
  };
}

function managedTag(): ManagedDevice {
  return {
    id: "remembered-tag",
    transportDeviceId: DISCOVERY.transportDeviceId,
    role: "tag",
    createdAt: 1,
    updatedAt: 1,
  };
}

function positionSample(
  receivedAt: number,
  xMeters: number,
  yMeters: number,
  zMeters: number,
): PansPositionStreamSample {
  return {
    deviceId: "tag",
    transportDeviceId: DISCOVERY.transportDeviceId,
    receivedAt,
    source: "notification",
    position: { xMeters, yMeters, zMeters, quality: 40 },
    distances: [],
    diagnostics: [],
    decoderDiagnostics: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
