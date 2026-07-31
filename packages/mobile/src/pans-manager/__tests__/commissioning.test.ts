import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansBatchOperationService } from "../PansBatchOperationService";
import { PansCommissioningService } from "../PansCommissioningService";
import type { PansConfigurationService } from "../PansConfigurationService";
import type {
  ManagedDevice,
  ManagedNetwork,
  PansConfigurationResult,
} from "../types";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

describe("PansCommissioningService profile assignment", () => {
  test("associates only after exact PAN readback and returns refreshed cache", async () => {
    const repository = await assignmentRepository("old");
    await repository.saveDevice({
      ...(await repository.getDevice("device"))!,
      lastKnownConfig: {
        role: "anchor",
        panId: 2,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
    });
    const configuration = configurationService(async (deviceId, panId) =>
      configurationResult(deviceId, panId),
    );
    const service = new PansCommissioningService(
      repository,
      configuration,
      () => 50,
    );

    const result = await service.assignDeviceToNetworkProfile({
      deviceId: "device",
      targetNetworkId: "target",
    });

    expect(result).toMatchObject({
      outcome: "assigned",
      stage: "complete",
      previousNetworkId: "old",
      targetNetworkId: "target",
      configuration: { inspected: { panId: 2 } },
      cachedConfig: { panId: 2 },
    });
    expect((await repository.getDevice("device"))?.networkId).toBe("target");
    expect((await repository.getDevice("device"))?.updatedAt).toBe(50);
  });

  test.each([
    [
      "PAN mismatch",
      configurationResult("device", 3, {
        outcome: "partial",
        error: {
          code: "VERIFY_MISMATCH",
          message: "mismatch",
        },
      }),
    ],
    [
      "persistence failure",
      configurationResult("device", 2, {
        outcome: "partial",
        error: {
          code: "STORAGE_FAILURE",
          message: "not saved",
        },
      }),
    ],
  ])("preserves the prior association after %s", async (_label, response) => {
    const repository = await assignmentRepository("old");
    const service = new PansCommissioningService(
      repository,
      configurationService(async () => response),
    );

    const result = await service.assignDeviceToNetworkProfile({
      deviceId: "device",
      targetNetworkId: "target",
    });

    expect(result).toMatchObject({
      outcome: "failed",
      stage: "configuration",
    });
    expect((await repository.getDevice("device"))?.networkId).toBe("old");
  });

  test("keeps an unassigned device unassigned when hardware fails", async () => {
    const repository = await assignmentRepository(undefined);
    const service = new PansCommissioningService(
      repository,
      configurationService(async () =>
        configurationResult("device", 7, {
          outcome: "failure",
          error: { code: "WRITE_FAILED", message: "failed" },
        }),
      ),
    );
    const result = await service.assignDeviceToNetworkProfile({
      deviceId: "device",
      targetNetworkId: "target",
    });
    expect(result.outcome).toBe("failed");
    expect((await repository.getDevice("device"))?.networkId).toBeUndefined();
  });

  test("rejects assigning a device to a legacy PAN 0 profile", async () => {
    const repository = await assignmentRepository(undefined);
    await repository.saveNetwork(network("target", 0));
    const configuration = configurationService(async (deviceId, panId) =>
      configurationResult(deviceId, panId),
    );
    const service = new PansCommissioningService(repository, configuration);

    await expect(
      service.assignDeviceToNetworkProfile({
        deviceId: "device",
        targetNetworkId: "target",
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      stage: "loading",
      error: { code: "INVALID_CONFIGURATION" },
    });
    expect(configuration.assignPanId).not.toHaveBeenCalled();
  });
});

describe("PansCommissioningService profile unassignment", () => {
  test("removes only the expected local association without hardware configuration", async () => {
    const repository = await assignmentRepository("old");
    const configuration = configurationService(async (deviceId, panId) =>
      configurationResult(deviceId, panId),
    );
    const service = new PansCommissioningService(
      repository,
      configuration,
      () => 75,
    );

    const result = await service.unassignDeviceFromNetworkProfile({
      deviceId: "device",
      expectedNetworkId: "old",
    });

    expect(result).toMatchObject({
      outcome: "unassigned",
      stage: "complete",
      previousNetworkId: "old",
      device: { id: "device", updatedAt: 75 },
    });
    expect((await repository.getDevice("device"))?.networkId).toBeUndefined();
    expect(configuration.assignPanId).not.toHaveBeenCalled();
    expect(configuration.configureDevice).not.toHaveBeenCalled();
  });

  test.each([undefined, "target"])(
    "rejects missing or stale association %s without changing it",
    async (networkId) => {
      const repository = await assignmentRepository(networkId);
      const configuration = configurationService(async (deviceId, panId) =>
        configurationResult(deviceId, panId),
      );
      const service = new PansCommissioningService(repository, configuration);

      const result = await service.unassignDeviceFromNetworkProfile({
        deviceId: "device",
        expectedNetworkId: "old",
      });

      expect(result).toMatchObject({
        outcome: "failed",
        stage: "loading",
        error: { code: "INVALID_CONFIGURATION" },
      });
      expect((await repository.getDevice("device"))?.networkId).toBe(networkId);
      expect(configuration.assignPanId).not.toHaveBeenCalled();
    },
  );
});

describe("PansCommissioningService PAN migration", () => {
  test("migrates all members sequentially before updating the profile", async () => {
    const repository = await migrationRepository(["b", "a"]);
    const calls: string[] = [];
    const service = migrationService(repository, async (deviceId, panId) => {
      calls.push(deviceId);
      return configurationResult(deviceId, panId);
    });

    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration-1",
    });

    expect(calls).toEqual(["a", "b"]);
    expect(result).toMatchObject({
      outcome: "migrated",
      profileUpdated: true,
      previousPanId: 1,
      operation: { id: "migration-1", status: "completed" },
    });
    expect(result.deviceResults.map((item) => item.outcome)).toEqual([
      "verified",
      "verified",
    ]);
    expect((await repository.getNetwork("profile"))?.panId).toBe(2);
  });

  test("leaves the profile unchanged and exposes a mismatched member", async () => {
    const repository = await migrationRepository(["a", "b"]);
    const service = migrationService(repository, async (deviceId, panId) =>
      deviceId === "b"
        ? configurationResult(deviceId, 9, {
            outcome: "partial",
            error: { code: "VERIFY_MISMATCH", message: "mismatch" },
          })
        : configurationResult(deviceId, panId),
    );

    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration-partial",
    });

    expect(result.outcome).toBe("partial");
    expect(result.profileUpdated).toBe(false);
    expect(result.deviceResults).toEqual([
      expect.objectContaining({ deviceId: "a", outcome: "verified" }),
      expect.objectContaining({
        deviceId: "b",
        outcome: "failed",
        configuration: expect.objectContaining({
          inspected: expect.objectContaining({ panId: 9 }),
        }),
      }),
    ]);
    expect((await repository.getNetwork("profile"))?.panId).toBe(1);
  });

  test("leaves the profile unchanged when migration is cancelled", async () => {
    const repository = await migrationRepository(["a", "b"]);
    const controller = new AbortController();
    const service = migrationService(repository, async (deviceId, panId) => {
      controller.abort();
      return configurationResult(deviceId, panId);
    });

    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration-cancelled",
      signal: controller.signal,
    });

    expect(result.outcome).toBe("cancelled");
    expect(result.deviceResults).toEqual([
      expect.objectContaining({ deviceId: "a", outcome: "verified" }),
      expect.objectContaining({ deviceId: "b", outcome: "cancelled" }),
    ]);
    expect((await repository.getNetwork("profile"))?.panId).toBe(1);
  });

  test("updates a zero-member local profile and records the operation", async () => {
    const repository = await migrationRepository([]);
    const assignPanId = jest.fn();
    const service = migrationService(repository, assignPanId);
    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 5,
      operationId: "migration-empty",
    });
    expect(result).toMatchObject({
      outcome: "migrated",
      profileUpdated: true,
      operation: { totalItems: 0, status: "completed" },
    });
    expect(assignPanId).not.toHaveBeenCalled();
    expect((await repository.getNetwork("profile"))?.panId).toBe(5);
  });

  test("rejects a duplicate saved PAN before touching hardware", async () => {
    const repository = await migrationRepository(["a"]);
    await repository.saveNetwork(network("other", 2));
    const assignPanId = jest.fn();
    const service = migrationService(repository, assignPanId);
    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration-duplicate",
    });
    expect(result).toMatchObject({
      outcome: "failure",
      profileUpdated: false,
      error: { code: "INVALID_CONFIGURATION" },
    });
    expect(assignPanId).not.toHaveBeenCalled();
    expect((await repository.getNetwork("profile"))?.panId).toBe(1);
  });

  test("does not update the profile when membership changes during the batch", async () => {
    const repository = await migrationRepository(["a"]);
    const service = migrationService(repository, async (deviceId, panId) => {
      await repository.saveDevice(device("new-member", "profile"));
      return configurationResult(deviceId, panId);
    });
    const result = await service.migrateNetworkProfilePan({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration-membership-change",
    });
    expect(result).toMatchObject({
      outcome: "partial",
      profileUpdated: false,
      membershipChanged: true,
    });
    expect((await repository.getNetwork("profile"))?.panId).toBe(1);
  });
});

function configurationService(
  implementation: (
    deviceId: string,
    panId: number,
  ) => Promise<PansConfigurationResult>,
): PansConfigurationService {
  return {
    assignPanId: jest.fn(implementation),
    configureDevice: jest.fn(),
  } as unknown as PansConfigurationService;
}

function migrationService(
  repository: InMemoryPansManagerRepository,
  implementation: (
    deviceId: string,
    panId: number,
  ) => Promise<PansConfigurationResult>,
): PansCommissioningService {
  return new PansCommissioningService(
    repository,
    configurationService(implementation),
    () => 100,
    new PansBatchOperationService(repository, () => 100),
  );
}

async function assignmentRepository(
  existingNetworkId: string | undefined,
): Promise<InMemoryPansManagerRepository> {
  const repository = new InMemoryPansManagerRepository();
  await repository.saveNetwork(network("old", 1));
  await repository.saveNetwork(network("target", 2));
  await repository.saveDevice(device("device", existingNetworkId));
  return repository;
}

async function migrationRepository(
  memberIds: string[],
): Promise<InMemoryPansManagerRepository> {
  const repository = new InMemoryPansManagerRepository();
  await repository.saveNetwork(network("profile", 1));
  for (const id of memberIds)
    await repository.saveDevice(device(id, "profile"));
  return repository;
}

function network(id: string, panId: number): ManagedNetwork {
  return {
    id,
    name: id,
    panId,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}

function device(id: string, networkId: string | undefined): ManagedDevice {
  return {
    id,
    ...(networkId ? { networkId } : {}),
    transportDeviceId: `transport-${id}`,
    createdAt: 1,
    updatedAt: 1,
  };
}

function configurationResult(
  deviceId: string,
  actualPanId: number,
  patch: Partial<PansConfigurationResult> = {},
): PansConfigurationResult {
  return {
    deviceId,
    transportDeviceId: `transport-${deviceId}`,
    outcome: "verified",
    inspected: {
      deviceId,
      transportDeviceId: `transport-${deviceId}`,
      inspectedAt: 1,
      panId: actualPanId,
      operationMode: {
        role: "anchor",
        uwbMode: "active",
        selectedFirmware: 1,
        accelerometerEnabled: false,
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        lowPowerModeEnabled: false,
        locationEngineEnabled: false,
        raw: [0, 0],
      },
      warnings: [],
    },
    writes: [],
    warnings: [],
    ...patch,
  };
}
