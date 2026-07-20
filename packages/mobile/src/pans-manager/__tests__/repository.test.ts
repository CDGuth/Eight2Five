import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

describe("InMemoryPansManagerRepository", () => {
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
});
