import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansConfigurationService } from "../PansConfigurationService";
import type { PansNativeGateway } from "../PansDeviceSessionManager";
import { PansDeviceSessionManager } from "../PansDeviceSessionManager";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

jest.mock("expo-pans-ble-api", () => ({}));

async function seedNetwork(
  repository: InMemoryPansManagerRepository,
  panId = 7,
): Promise<void> {
  await repository.saveNetwork({
    id: "network",
    name: "Network",
    panId,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  });
}

const mode = {
  role: "anchor" as const,
  uwbMode: "active" as const,
  selectedFirmware: 1 as const,
  accelerometerEnabled: false,
  ledEnabled: true,
  firmwareUpdateEnabled: false,
  initiatorEnabled: false,
  lowPowerModeEnabled: false,
  locationEngineEnabled: false,
  raw: [0, 0] as [number, number],
};

describe("PansConfigurationService", () => {
  test("inspectAndCache retains hardware cache when optional reads are unavailable", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      requestExplicitDisconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      readLabel: jest.fn(async () => {
        throw { code: "CHARACTERISTIC_NOT_FOUND", message: "unavailable" };
      }),
      readNetworkId: jest.fn(async () => {
        throw { code: "UNSUPPORTED", message: "unavailable" };
      }),
      readDeviceInfo: jest.fn(async () => ({
        nodeIdHex: "00AB",
        lowNodeId: 0xab,
        hardwareVersion: 1,
        firmware1Version: 2,
        firmware2Version: 3,
        firmware1Checksum: 4,
        firmware2Checksum: 5,
        operationFlags: 0,
        raw: [],
      })),
      readLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    const savedPosition = {
      xMeters: 1,
      yMeters: 2,
      zMeters: 3,
      quality: 90,
    };
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      label: "previous label",
      lastKnownConfig: {
        role: "anchor",
        label: "stale cached label",
        panId: 99,
        uwbMode: "passive",
        ledEnabled: false,
        firmwareUpdateEnabled: true,
        initiatorEnabled: true,
        position: savedPosition,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
      () => 500,
    );

    await service.inspect("anchor");
    expect((await repository.getDevice("anchor"))?.updatedAt).toBe(1);
    expect(await repository.getLatestDeviceSnapshot("anchor")).toBeUndefined();

    const inspection = await service.inspectAndCache("anchor");

    expect(inspection).toMatchObject({
      deviceId: "anchor",
      inspectedAt: 500,
      deviceInfo: { nodeIdHex: "00AB" },
    });
    expect(await repository.getDevice("anchor")).toMatchObject({
      label: "stale cached label",
      nodeIdHex: "00AB",
      role: "anchor",
      updatedAt: 500,
      lastKnownConfig: {
        role: "anchor",
        label: "stale cached label",
        panId: 99,
        uwbMode: "active",
        selectedFirmware: 1,
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        position: savedPosition,
      },
    });
    const persisted = await repository.getDevice("anchor");
    expect(persisted?.lastKnownConfig).toMatchObject({
      label: "stale cached label",
      panId: 99,
    });
    expect(await repository.getLatestDeviceSnapshot("anchor")).toMatchObject({
      capturedAt: 500,
      inspection: { deviceId: "anchor", inspectedAt: 500 },
      config: {
        label: "stale cached label",
        panId: 99,
        position: savedPosition,
      },
    });
  });

  test("inspectAndCache does not invent an unavailable tag location mode", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      requestExplicitDisconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => ({
        ...mode,
        role: "tag" as const,
        locationEngineEnabled: true,
      })),
      readLabel: jest.fn(async () => "tag"),
      readNetworkId: jest.fn(async () => 7),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(async () => {
        throw { code: "UNSUPPORTED", message: "unavailable" };
      }),
      readTagUpdateRate: jest.fn(async () => {
        throw { code: "UNSUPPORTED", message: "unavailable" };
      }),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "tag",
      transportDeviceId: "transport-tag",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await service.inspectAndCache("tag");

    const persisted = await repository.getDevice("tag");
    const snapshot = await repository.getLatestDeviceSnapshot("tag");
    expect(persisted?.lastKnownConfig).not.toHaveProperty("locationDataMode");
    expect(snapshot?.config).not.toHaveProperty("locationDataMode");
  });

  test("inspection tolerates unavailable optional characteristics", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      readLabel: jest.fn(async () => {
        throw {
          code: "CHARACTERISTIC_NOT_FOUND",
          message: "label unavailable",
        };
      }),
      readNetworkId: jest.fn(async () => 7),
      readDeviceInfo: jest.fn(async () => {
        throw { code: "UNSUPPORTED", message: "device info unavailable" };
      }),
      writeLabel: jest.fn(),
      writeNetworkId: jest.fn(),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport-device",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(service.inspect("device")).resolves.toMatchObject({
      deviceId: "device",
      transportDeviceId: "transport-device",
      panId: 7,
      warnings: [
        "label is unavailable on this device.",
        "device information is unavailable on this device.",
      ],
    });
  });

  test("writes deterministically, reports readback mismatch, and persists partial state", async () => {
    const calls: string[] = [];
    const labels = ["old", "wrong", "wrong"];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => {
        calls.push("readLabel");
        return labels.shift() ?? "wrong";
      }),
      writeLabel: jest.fn(async () => {
        calls.push("writeLabel");
        return true;
      }),
      readNetworkId: jest.fn(async () => {
        calls.push("readPan");
        return 7;
      }),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => {
        calls.push("readMode");
        return mode;
      }),
      patchOperationMode: jest.fn(async () => mode),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => {
        calls.push("readInfo");
        return { raw: [] };
      }),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport-device",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );
    const result = await service.configureDevice("device", {
      role: "anchor",
      label: "new",
      panId: 8,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
    });
    expect(result.outcome).toBe("partial");
    expect(native.writeNetworkId).not.toHaveBeenCalled();
    expect(result.writes[0]).toMatchObject({
      field: "label",
      status: "mismatch",
      actual: "wrong",
    });
    expect(calls.slice(0, 6)).toEqual([
      "readMode",
      "readLabel",
      "readPan",
      "readInfo",
      "writeLabel",
      "readLabel",
    ]);
    expect(await repository.getLatestDeviceSnapshot("device")).toBeDefined();
    expect(await repository.getDevice("device")).toMatchObject({
      label: "wrong",
      lastKnownConfig: { role: "anchor", label: "wrong", panId: 7 },
    });
  });

  test("rejects changed update rates before any writes", async () => {
    const tagMode = { ...mode, role: "tag" as const };
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "tag"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => 1),
      writeNetworkId: jest.fn(),
      readOperationMode: jest.fn(async () => tagMode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(async () => 1 as const),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(async () => ({
        movingUpdateRateMs: 100,
        stationaryUpdateRateMs: 1000,
        raw: [],
      })),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "tag",
      transportDeviceId: "transport-tag",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );
    await expect(
      service.configureTag("tag", {
        role: "tag",
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        locationEngineEnabled: false,
        lowPowerModeEnabled: false,
        stationaryDetectionEnabled: false,
        locationDataMode: 1,
        movingUpdateRateMs: 200,
      }),
    ).resolves.toMatchObject({
      outcome: "failure",
      error: { code: "UNSUPPORTED_FEATURE" },
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
  });

  test("migrates only the PAN ID and requires exact readback", async () => {
    const panReads = [1, 2, 2];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "anchor"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => panReads.shift() ?? 2),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({
        nodeIdHex: "0001",
        lowNodeId: 1,
        hardwareVersion: 1,
        firmware1Version: 1,
        firmware2Version: 1,
        firmware1Checksum: 1,
        firmware2Checksum: 1,
        operationFlags: 0,
        raw: [],
      })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 1,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(service.assignPanId("anchor", 2)).resolves.toMatchObject({
      outcome: "verified",
      inspected: { panId: 2 },
      writes: [{ field: "panId", status: "verified", actual: 2 }],
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
    expect(native.writePersistedPosition).not.toHaveBeenCalled();
    expect(await repository.getDevice("anchor")).toMatchObject({
      lastKnownConfig: {
        panId: 2,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
    });
  });

  test("persists final PAN readback instead of the mismatched requested PAN", async () => {
    const panReads = [1, 3, 3];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => panReads.shift() ?? 3),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 1,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    const result = await service.assignPanId("anchor", 2);
    expect(result).toMatchObject({
      outcome: "partial",
      error: { code: "VERIFY_MISMATCH" },
      inspected: { panId: 3 },
    });
    expect(await repository.getDevice("anchor")).toMatchObject({
      label: "hardware",
      lastKnownConfig: {
        panId: 3,
        label: "hardware",
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
    });
  });

  test("unassigns hardware by verifying passive UWB before restoring PANS default PAN 0", async () => {
    const calls: string[] = [];
    let currentPanId = 7;
    let currentMode: Awaited<
      ReturnType<PansNativeGateway["readOperationMode"]>
    > = mode;
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      readNetworkId: jest.fn(async () => {
        calls.push("read-pan");
        return currentPanId;
      }),
      writeNetworkId: jest.fn(async (_transportId: string, panId: number) => {
        calls.push("write-pan");
        currentPanId = panId;
        return true;
      }),
      readOperationMode: jest.fn(async () => {
        calls.push("read-mode");
        return currentMode;
      }),
      patchOperationMode: jest.fn(async () => {
        calls.push("patch-mode");
        currentMode = { ...currentMode, uwbMode: "passive" as const };
      }),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await seedNetwork(repository);
    await repository.saveDevice({
      id: "anchor",
      networkId: "network",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    const result = await service.unassignDeviceHardware("anchor");

    expect(result).toMatchObject({
      outcome: "verified",
      inspected: { panId: 0, operationMode: { uwbMode: "passive" } },
      writes: [
        { field: "uwbMode", status: "verified", actual: "passive" },
        { field: "panId", status: "verified", actual: 0 },
      ],
    });
    expect(calls.indexOf("patch-mode")).toBeLessThan(
      calls.indexOf("write-pan"),
    );
    expect(await repository.getDevice("anchor")).toMatchObject({
      networkId: "network",
      lastKnownConfig: { panId: 0, uwbMode: "passive" },
    });
  });

  test("does not unassign hardware when its PAN no longer matches the saved association", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      readNetworkId: jest.fn(async () => 9),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(async () => undefined),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await seedNetwork(repository, 7);
    await repository.saveDevice({
      id: "anchor",
      networkId: "network",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(
      service.unassignDeviceHardware("anchor"),
    ).resolves.toMatchObject({
      outcome: "partial",
      inspected: { panId: 9 },
      writes: [
        {
          field: "panId",
          status: "skipped",
          requested: 0,
          actual: 9,
        },
      ],
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
    expect(native.writeNetworkId).not.toHaveBeenCalled();
  });

  test("does not write the unassigned PAN when passive UWB readback mismatches", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      readNetworkId: jest.fn(async () => 7),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(async () => undefined),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await seedNetwork(repository);
    await repository.saveDevice({
      id: "anchor",
      networkId: "network",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(
      service.unassignDeviceHardware("anchor"),
    ).resolves.toMatchObject({
      outcome: "partial",
      error: { code: "VERIFY_MISMATCH" },
      writes: [
        { field: "uwbMode", status: "mismatch" },
        { field: "panId", status: "skipped" },
      ],
    });
    expect(native.writeNetworkId).not.toHaveBeenCalled();
    expect(await repository.getDevice("anchor")).toMatchObject({
      networkId: "network",
      lastKnownConfig: { panId: 7, uwbMode: "active" },
    });
  });

  test("reports and persists an unassigned-PAN readback mismatch after passive verification", async () => {
    const panReads = [7, 9, 9];
    const passiveMode = { ...mode, uwbMode: "passive" as const };
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      readNetworkId: jest.fn(async () => panReads.shift() ?? 9),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => passiveMode),
      patchOperationMode: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await seedNetwork(repository);
    await repository.saveDevice({
      id: "anchor",
      networkId: "network",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(
      service.unassignDeviceHardware("anchor"),
    ).resolves.toMatchObject({
      outcome: "partial",
      error: { code: "VERIFY_MISMATCH" },
      writes: [
        { field: "uwbMode", status: "verified" },
        { field: "panId", status: "mismatch", actual: 9 },
      ],
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
    expect(await repository.getDevice("anchor")).toMatchObject({
      networkId: "network",
      lastKnownConfig: { panId: 9, uwbMode: "passive" },
    });
  });

  test("applies sparse dirty fields, preserves reserved mode bytes and independently saved local details", async () => {
    let actualMode: Awaited<
      ReturnType<PansNativeGateway["readOperationMode"]>
    > = {
      ...mode,
      raw: [0xa5, 0xc3] as [number, number],
    };
    let label = "hardware";
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      nickname: "Old app name",
      notes: "User notes",
      lastKnownConfig: {
        role: "anchor",
        label,
        panId: 9,
        uwbMode: "active",
        selectedFirmware: 1,
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      requestExplicitDisconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => actualMode),
      patchOperationMode: jest.fn(
        async (
          _id: string,
          patch: Parameters<PansNativeGateway["patchOperationMode"]>[1],
        ) => {
          actualMode = { ...actualMode, ...patch };
          return actualMode;
        },
      ),
      readLabel: jest.fn(async () => label),
      writeLabel: jest.fn(async () => {
        label = "";
        const latest = (await repository.getDevice("anchor"))!;
        await repository.saveDevice({
          ...latest,
          nickname: "New app name",
          notes: "Updated user notes",
          updatedAt: 10,
        });
        return true;
      }),
      readNetworkId: jest.fn(async () => 9),
      writeNetworkId: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      writePersistedPosition: jest.fn(async () => true),
    } as unknown as PansNativeGateway;
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
      () => 100,
    );
    const position = { xMeters: 1, yMeters: 2, zMeters: 3, quality: 99 };

    const result = await service.applyConfigurationDiff("anchor", {
      label: "",
      selectedFirmware: 2,
      ledEnabled: false,
      position,
    });

    expect(native.writeLabel).toHaveBeenCalledWith("transport-anchor", "");
    expect(native.patchOperationMode).toHaveBeenCalledWith("transport-anchor", {
      selectedFirmware: 2,
      ledEnabled: false,
    });
    expect(native.writeNetworkId).not.toHaveBeenCalled();
    expect(actualMode.raw).toEqual([0xa5, 0xc3]);
    expect(result.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "label", status: "verified" }),
        expect.objectContaining({
          field: "selectedFirmware",
          status: "verified",
        }),
        expect.objectContaining({ field: "ledEnabled", status: "verified" }),
        expect.objectContaining({
          field: "position",
          status: "written-unverified",
        }),
      ]),
    );
    expect(await repository.getDevice("anchor")).toMatchObject({
      nickname: "New app name",
      notes: "Updated user notes",
      label: "",
      lastKnownConfig: {
        label: "",
        panId: 9,
        selectedFirmware: 2,
        ledEnabled: false,
        position,
      },
    });
  });

  test("writes only a dirty tag location mode and never invents other values", async () => {
    let locationDataMode: 0 | 1 = 0;
    const tagMode = {
      ...mode,
      role: "tag" as const,
      accelerometerEnabled: true,
      locationEngineEnabled: true,
    };
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      requestExplicitDisconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => tagMode),
      patchOperationMode: jest.fn(),
      readLabel: jest.fn(async () => "tag"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => 4),
      writeNetworkId: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      readLocationDataMode: jest.fn(async () => locationDataMode),
      writeLocationDataMode: jest.fn(async () => {
        locationDataMode = 1;
        return true;
      }),
      readTagUpdateRate: jest.fn(async () => ({
        movingUpdateRateMs: 100,
        stationaryUpdateRateMs: 1000,
        raw: [],
      })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "tag",
      transportDeviceId: "transport-tag",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    const result = await service.applyConfigurationDiff("tag", {
      locationDataMode: 1,
    });

    expect(native.writeLocationDataMode).toHaveBeenCalledTimes(1);
    expect(native.patchOperationMode).not.toHaveBeenCalled();
    expect(native.writeLabel).not.toHaveBeenCalled();
    expect(native.writeNetworkId).not.toHaveBeenCalled();
    expect(result.writes).toEqual([
      expect.objectContaining({
        field: "locationDataMode",
        status: "verified",
        actual: 1,
      }),
    ]);
    expect(await repository.getDevice("tag")).toMatchObject({
      lastKnownConfig: {
        role: "tag",
        selectedFirmware: 1,
        locationDataMode: 1,
        movingUpdateRateMs: 100,
        stationaryUpdateRateMs: 1000,
      },
    });
  });
});
