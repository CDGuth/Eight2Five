import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedNetworkSettings,
  type PansManagerSettings,
} from "../types";

describe("InMemoryPansManagerRepository", () => {
  test("write methods return normalized canonical clones", async () => {
    const repository = new InMemoryPansManagerRepository();
    const network = await repository.saveNetwork({
      id: "network",
      name: "Network",
      panId: 1,
      settings: {
        coordinateBounds: { minXMeters: -5 },
        defaultTagMode: {},
        scanDurationMs: 123,
      } as unknown as ManagedNetworkSettings,
      createdAt: 1,
      updatedAt: 1,
    });
    expect(network.settings.coordinateBounds.minXMeters).toBe(-5);
    expect(network.settings.coordinateBounds.maxXMeters).toBe(1_000);
    expect(network.settings).not.toHaveProperty("scanDurationMs");
    network.settings.coordinateBounds.minXMeters = 99;
    expect(
      (await repository.getNetwork("network"))?.settings.coordinateBounds
        .minXMeters,
    ).toBe(-5);

    const device = await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport",
      createdAt: 2,
      updatedAt: 2,
    });
    const associated = await repository.associateDevice({
      networkId: "network",
      deviceId: "device",
      associatedAt: 3,
    });
    expect(associated).toMatchObject({ networkId: "network", updatedAt: 3 });
    associated.transportDeviceId = "mutated";
    expect((await repository.getDevice("device"))?.transportDeviceId).toBe(
      "transport",
    );
    const dissociated = await repository.dissociateDevice(
      "network",
      "device",
      4,
    );
    expect(dissociated).not.toHaveProperty("networkId");
    expect(dissociated.updatedAt).toBe(4);
    expect(device).not.toBe(associated);

    const settings = await repository.saveSettings({
      connectionTimeoutMs: 25,
      discoveryScanDurationMs: 99,
    } as unknown as PansManagerSettings);
    expect(settings.connectionTimeoutMs).toBe(25);
    expect(settings.discoveryStaleAfterMs).toBe(10_000);
    expect(settings).not.toHaveProperty("discoveryScanDurationMs");
    settings.connectionTimeoutMs = 100;
    expect((await repository.getSettings())?.connectionTimeoutMs).toBe(25);

    const snapshot = await repository.saveDeviceSnapshot({
      deviceId: "device",
      capturedAt: 5,
      config: {
        role: "anchor",
        label: "A",
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
    });
    snapshot.config.label = "mutated";
    expect(
      (await repository.getLatestDeviceSnapshot("device"))?.config.label,
    ).toBe("A");
  });

  test("saveNetworks stores an input-ordered batch atomically", async () => {
    const repository = new InMemoryPansManagerRepository();
    const networks = [
      {
        id: "second",
        name: "Second",
        panId: 2,
        settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "first",
        name: "First",
        panId: 1,
        settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const saved = await repository.saveNetworks(networks);
    expect(saved.map(({ id }) => id)).toEqual(["second", "first"]);
    saved[0].name = "mutated";
    expect((await repository.getNetwork("second"))?.name).toBe("Second");

    const cyclicSettings = {
      ...DEFAULT_MANAGED_NETWORK_SETTINGS,
    } as ManagedNetworkSettings & Record<string, unknown>;
    cyclicSettings.invalid = cyclicSettings;
    await expect(
      repository.saveNetworks([
        {
          ...networks[0],
          id: "would-partially-save",
          name: "Would partially save",
        },
        {
          ...networks[1],
          id: "invalid",
          name: "Invalid",
          settings: cyclicSettings,
        },
      ]),
    ).rejects.toThrow();
    expect(await repository.getNetwork("would-partially-save")).toBeUndefined();
  });

  test("bulk latest snapshots use insertion order to break timestamp ties", async () => {
    const repository = new InMemoryPansManagerRepository();
    const snapshot = (deviceId: string, capturedAt: number, label: string) => ({
      deviceId,
      capturedAt,
      config: {
        role: "anchor" as const,
        label,
        uwbMode: "active" as const,
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
    });
    await repository.saveDeviceSnapshot(snapshot("a", 10, "older-id"));
    await repository.saveDeviceSnapshot(snapshot("a", 10, "newer-id"));
    await repository.saveDeviceSnapshot(snapshot("b", 20, "B"));

    const latest = await repository.getLatestDeviceSnapshots([
      "a",
      "missing",
      "b",
    ]);
    expect(latest.a?.config.label).toBe("newer-id");
    expect(latest.b?.config.label).toBe("B");
    expect(latest.missing).toBeUndefined();
    latest.a!.config.label = "mutated";
    expect((await repository.getLatestDeviceSnapshot("a"))?.config.label).toBe(
      "newer-id",
    );
    expect(await repository.getLatestDeviceSnapshots([])).toEqual({});
  });

  test("stores networks, devices, associations, snapshots and logs without sharing references", async () => {
    const repository = new InMemoryPansManagerRepository();
    const now = 1_767_225_600_000;
    await repository.saveNetwork({
      id: "n",
      name: "Network",
      panId: 1,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "ios-uuid",
      createdAt: now,
      updatedAt: now,
    });
    await repository.associateDevice({
      networkId: "n",
      deviceId: "device",
      associatedAt: now,
    });
    const devices = await repository.listNetworkDevices("n");
    devices[0].id = "mutated";
    expect((await repository.listNetworkDevices("n"))[0].id).toBe("device");

    await repository.savePositionLogSession({
      id: "log",
      networkId: "n",
      panId: 1,
      deviceId: "device",
      startedAt: now,
    });
    await repository.appendPositionLogSamples([
      {
        sessionId: "log",
        sequence: 1,
        timestampMs: 2,
        networkId: "n",
        panId: 1,
        deviceId: "device",
        xMeters: 1,
        yMeters: 2,
        zMeters: 3,
        quality: 90,
        solver: "pans",
        anchorCount: 4,
      },
      {
        sessionId: "log",
        sequence: 0,
        timestampMs: 1,
        networkId: "n",
        panId: 1,
        deviceId: "device",
        xMeters: 0,
        yMeters: 0,
        zMeters: 0,
        quality: 100,
        solver: "pans",
        anchorCount: 4,
      },
    ]);
    expect(
      (await repository.listPositionLogSamples("log")).map(
        (sample) => sample.sequence,
      ),
    ).toEqual([0, 1]);

    await repository.dissociateDevice("n", "device", now + 1);
    expect(await repository.getDevice("device")).toMatchObject({
      updatedAt: now + 1,
    });
    expect((await repository.getDevice("device"))?.networkId).toBeUndefined();
  });

  test("rejects associations to missing records instead of silently doing nothing", async () => {
    const repository = new InMemoryPansManagerRepository();
    await expect(
      repository.associateDevice({
        networkId: "missing",
        deviceId: "device",
        associatedAt: 1,
      }),
    ).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND" });
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(
      repository.associateDevice({
        networkId: "missing",
        deviceId: "device",
        associatedAt: 2,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CONFIGURATION" });
  });

  test("deleting a network keeps devices but removes profile logs", async () => {
    const repository = new InMemoryPansManagerRepository();
    await repository.saveNetwork({
      id: "network",
      name: "Network",
      panId: 7,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: 1,
      updatedAt: 1,
    });
    await repository.saveDevice({
      id: "device",
      networkId: "network",
      transportDeviceId: "transport",
      createdAt: 1,
      updatedAt: 1,
    });
    await repository.savePositionLogSession({
      id: "log",
      networkId: "network",
      panId: 7,
      deviceId: "device",
      startedAt: 1,
    });

    await repository.deleteNetwork("network");

    expect(await repository.getNetwork("network")).toBeUndefined();
    expect(await repository.getDevice("device")).toEqual(
      expect.not.objectContaining({ networkId: expect.anything() }),
    );
    expect(await repository.listPositionLogSessions()).toEqual([]);
  });

  test("deleting a device removes snapshots and position logs", async () => {
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport",
      createdAt: 1,
      updatedAt: 1,
    });
    await repository.saveDeviceSnapshot({
      deviceId: "device",
      capturedAt: 1,
      config: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
    });
    await repository.savePositionLogSession({
      id: "log",
      networkId: "network",
      panId: 7,
      deviceId: "device",
      startedAt: 1,
    });

    await repository.deleteDevice("device");

    expect(await repository.getDevice("device")).toBeUndefined();
    expect(await repository.listDeviceSnapshots("device")).toEqual([]);
    expect(await repository.listPositionLogSessions()).toEqual([]);
    expect(await repository.listPositionLogSamples("log")).toEqual([]);
  });
});
