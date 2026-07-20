import { ManagerError, normalizeManagerError } from "./errors";
import type { ManagerErrorCode } from "./errors";
import { PansBatchOperationService } from "./PansBatchOperationService";
import type { PansBatchRunResult } from "./PansBatchOperationService";
import type { PansManagerRepository } from "./PansManagerRepository";
import { PansConfigurationService } from "./PansConfigurationService";
import type {
  ManagedDevice,
  ManagedDeviceConfig,
  ManagedNetwork,
  PansBatchOperationItem,
  PansBatchOperationRecord,
  PansConfigurationResult,
} from "./types";
import { assertPanId, assertUniqueName } from "./validation";

export interface PansCommissioningDevice {
  device: ManagedDevice;
  config: ManagedDeviceConfig;
}

export interface PansCommissioningResult {
  network: ManagedNetwork;
  results: PansConfigurationResult[];
}

export interface AssignDeviceToNetworkProfileInput {
  deviceId: string;
  targetNetworkId: string;
}

export type AssignDeviceToNetworkProfileStage =
  | "loading"
  | "configuration"
  | "association"
  | "complete";

export type AssignDeviceToNetworkProfileOutcome = "assigned" | "failed";

export interface CommissioningOperationError {
  code: ManagerErrorCode;
  message: string;
}

export interface AssignDeviceToNetworkProfileResult {
  deviceId: string;
  targetNetworkId: string;
  previousNetworkId?: string;
  stage: AssignDeviceToNetworkProfileStage;
  outcome: AssignDeviceToNetworkProfileOutcome;
  configuration?: PansConfigurationResult;
  cachedConfig?: ManagedDeviceConfig;
  device?: ManagedDevice;
  network?: ManagedNetwork;
  error?: CommissioningOperationError;
}

export interface MigrateNetworkProfilePanInput {
  networkId: string;
  targetPanId: number;
  /** Stable, caller-supplied ID used to persist and retry the batch. */
  operationId: string;
  signal?: AbortSignal;
  onItemChange?(item: PansBatchOperationItem): void;
}

export type NetworkProfilePanMigrationOutcome =
  | "migrated"
  | "partial"
  | "cancelled"
  | "failure";

export interface NetworkProfilePanMigrationDeviceResult {
  deviceId: string;
  outcome: "verified" | "failed" | "cancelled";
  configuration?: PansConfigurationResult;
  error?: CommissioningOperationError;
}

export interface MigrateNetworkProfilePanResult {
  operationId: string;
  networkId: string;
  targetPanId: number;
  previousPanId?: number;
  outcome: NetworkProfilePanMigrationOutcome;
  profileUpdated: boolean;
  membershipChanged: boolean;
  deviceResults: NetworkProfilePanMigrationDeviceResult[];
  operation?: PansBatchOperationRecord;
  items?: PansBatchOperationItem[];
  network?: ManagedNetwork;
  error?: CommissioningOperationError;
}

/** Coordinates app-profile persistence and hardware configuration. */
export class PansCommissioningService {
  private readonly batch: PansBatchOperationService;

  constructor(
    private readonly repository: PansManagerRepository,
    private readonly configuration: PansConfigurationService,
    private readonly now: () => number = Date.now,
    batch?: PansBatchOperationService,
  ) {
    this.batch = batch ?? new PansBatchOperationService(repository, now);
  }

  async assignDeviceToNetworkProfile({
    deviceId,
    targetNetworkId,
  }: AssignDeviceToNetworkProfileInput): Promise<AssignDeviceToNetworkProfileResult> {
    let device: ManagedDevice | undefined;
    let network: ManagedNetwork | undefined;
    try {
      [device, network] = await Promise.all([
        this.repository.getDevice(deviceId),
        this.repository.getNetwork(targetNetworkId),
      ]);
      if (!device) {
        throw new ManagerError(
          "DEVICE_NOT_FOUND",
          "The managed device does not exist.",
          { deviceId, operation: "assign network profile" },
        );
      }
      if (!network) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "The target network profile does not exist.",
          { deviceId, operation: "assign network profile" },
        );
      }
    } catch (error) {
      return assignmentFailure(
        deviceId,
        targetNetworkId,
        device,
        network,
        "loading",
        error,
      );
    }

    let configuration: PansConfigurationResult;
    try {
      // assignPanId inspects before writing, writes only when needed, performs
      // final readback, and refreshes the cached hardware configuration.
      configuration = await this.configuration.assignPanId(
        device.id,
        network.panId,
      );
    } catch (error) {
      return assignmentFailure(
        deviceId,
        targetNetworkId,
        device,
        network,
        "configuration",
        error,
      );
    }

    if (!isExactPanConfiguration(configuration, network.panId)) {
      const error = configuration.error ?? {
        code: "VERIFY_MISMATCH" as const,
        message: "PAN ID readback did not match the target network profile.",
      };
      return {
        ...assignmentBase(device, network),
        stage: "configuration",
        outcome: "failed",
        configuration,
        error,
      };
    }

    try {
      await this.repository.associateDevice({
        networkId: network.id,
        deviceId: device.id,
        associatedAt: this.now(),
      });
      const refreshed = await this.repository.getDevice(device.id);
      if (!refreshed) {
        throw new ManagerError(
          "STORAGE_FAILURE",
          "The assigned device could not be reloaded.",
          { deviceId, operation: "assign network profile" },
        );
      }
      return {
        ...assignmentBase(device, network),
        stage: "complete",
        outcome: "assigned",
        configuration,
        ...(refreshed.lastKnownConfig
          ? { cachedConfig: refreshed.lastKnownConfig }
          : {}),
        device: refreshed,
      };
    } catch (error) {
      return {
        ...assignmentFailure(
          deviceId,
          targetNetworkId,
          device,
          network,
          "association",
          error,
        ),
        configuration,
      };
    }
  }

  async migrateNetworkProfilePan(
    input: MigrateNetworkProfilePanInput,
  ): Promise<MigrateNetworkProfilePanResult> {
    const base = {
      operationId: input.operationId,
      networkId: input.networkId,
      targetPanId: input.targetPanId,
      profileUpdated: false,
      membershipChanged: false,
      deviceResults: [] as NetworkProfilePanMigrationDeviceResult[],
    };
    let network: ManagedNetwork | undefined;
    let memberIds: string[] = [];

    try {
      if (!input.operationId.trim()) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "A stable operation ID is required for PAN migration.",
        );
      }
      assertPanId(input.targetPanId);
      const [loadedNetwork, profiles] = await Promise.all([
        this.repository.getNetwork(input.networkId),
        this.repository.listNetworks(),
      ]);
      if (!loadedNetwork) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "The network profile does not exist.",
        );
      }
      network = loadedNetwork;
      if (
        profiles.some(
          (profile) =>
            profile.id !== network!.id && profile.panId === input.targetPanId,
        )
      ) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "Another saved network profile already uses that PAN ID.",
        );
      }
      memberIds = sortIds(
        (await this.repository.listNetworkDevices(network.id)).map(
          (device) => device.id,
        ),
      );
      const existingOperation = await this.repository.getBatchOperation(
        input.operationId,
      );
      validateMigrationRetry(existingOperation, network.id, input.targetPanId);
      const originalMemberIds = migrationMemberIds(existingOperation);
      if (originalMemberIds && !sameIds(originalMemberIds, memberIds)) {
        return {
          ...base,
          previousPanId: network.panId,
          outcome: "partial",
          membershipChanged: true,
          network,
          error: {
            code: "INVALID_CONFIGURATION",
            message:
              "Network profile membership changed since this migration began.",
          },
        };
      }
    } catch (error) {
      return {
        ...base,
        ...(network ? { previousPanId: network.panId, network } : {}),
        outcome: "failure",
        error: operationError(error, "migrate network profile PAN"),
      };
    }

    const resolvedConfigurations = new Map<string, PansConfigurationResult>();
    let batchResult: PansBatchRunResult<PansConfigurationResult>;
    try {
      batchResult = await this.batch.run({
        id: input.operationId,
        type: "network-profile-pan-migration",
        deviceIds: memberIds,
        signal: input.signal,
        onItemChange: input.onItemChange,
        metadata: {
          networkId: network.id,
          previousPanId: network.panId,
          targetPanId: input.targetPanId,
          memberDeviceIds: memberIds,
        },
        operation: async (deviceId) => {
          const result = await this.configuration.assignPanId(
            deviceId,
            input.targetPanId,
          );
          resolvedConfigurations.set(deviceId, result);
          if (!isExactPanConfiguration(result, input.targetPanId)) {
            throw new ManagerError(
              result.error?.code ?? "VERIFY_MISMATCH",
              result.error?.message ??
                "PAN ID readback did not match the migration target.",
              { deviceId, operation: "migrate network profile PAN" },
            );
          }
          return result;
        },
      });
    } catch (error) {
      return {
        ...base,
        previousPanId: network.panId,
        outcome: resolvedConfigurations.size ? "partial" : "failure",
        deviceResults: memberIds.map((deviceId) => {
          const configuration = resolvedConfigurations.get(deviceId);
          return {
            deviceId,
            outcome:
              configuration &&
              isExactPanConfiguration(configuration, input.targetPanId)
                ? ("verified" as const)
                : ("failed" as const),
            ...(configuration ? { configuration } : {}),
            ...(!configuration ||
            !isExactPanConfiguration(configuration, input.targetPanId)
              ? { error: operationError(error, "migrate network profile PAN") }
              : {}),
          };
        }),
        network,
        error: operationError(error, "migrate network profile PAN"),
      };
    }

    const deviceResults = migrationDeviceResults(
      batchResult.items,
      resolvedConfigurations,
      input.targetPanId,
    );
    const cancelled = batchResult.operation.status === "cancelled";
    const allVerified =
      !cancelled &&
      deviceResults.length === memberIds.length &&
      deviceResults.every((result) => result.outcome === "verified");
    let latestMemberIds: string[];
    try {
      latestMemberIds = sortIds(
        (await this.repository.listNetworkDevices(network.id)).map(
          (device) => device.id,
        ),
      );
    } catch (error) {
      return {
        ...base,
        previousPanId: network.panId,
        outcome: "partial",
        deviceResults,
        operation: batchResult.operation,
        items: batchResult.items,
        network,
        error: operationError(error, "verify network profile membership"),
      };
    }
    const membershipChanged = !sameIds(memberIds, latestMemberIds);

    if (!allVerified || membershipChanged) {
      return {
        ...base,
        previousPanId: network.panId,
        outcome: cancelled ? "cancelled" : "partial",
        membershipChanged,
        deviceResults,
        operation: batchResult.operation,
        items: batchResult.items,
        network,
        ...(membershipChanged
          ? {
              error: {
                code: "INVALID_CONFIGURATION" as const,
                message:
                  "Network profile membership changed during PAN migration.",
              },
            }
          : {}),
      };
    }

    try {
      const [latestNetwork, profiles] = await Promise.all([
        this.repository.getNetwork(network.id),
        this.repository.listNetworks(),
      ]);
      if (!latestNetwork) {
        throw new ManagerError(
          "STORAGE_FAILURE",
          "The network profile disappeared during PAN migration.",
        );
      }
      if (
        profiles.some(
          (profile) =>
            profile.id !== latestNetwork.id &&
            profile.panId === input.targetPanId,
        )
      ) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "Another saved network profile now uses that PAN ID.",
        );
      }
      const updatedNetwork = {
        ...latestNetwork,
        panId: input.targetPanId,
        updatedAt: this.now(),
      };
      await this.repository.saveNetwork(updatedNetwork);
      return {
        ...base,
        previousPanId: network.panId,
        outcome: "migrated",
        profileUpdated: true,
        deviceResults,
        operation: batchResult.operation,
        items: batchResult.items,
        network: updatedNetwork,
      };
    } catch (error) {
      return {
        ...base,
        previousPanId: network.panId,
        outcome: "partial",
        deviceResults,
        operation: batchResult.operation,
        items: batchResult.items,
        network,
        error: operationError(error, "save migrated network profile"),
      };
    }
  }

  async commissionNetwork(
    network: ManagedNetwork,
    devices: PansCommissioningDevice[],
  ): Promise<PansCommissioningResult> {
    assertPanId(network.panId);
    const existing = await this.repository.listNetworks();
    assertUniqueName(
      network.name,
      existing.map((item) => item.name),
      existing.find((item) => item.id === network.id)?.name,
    );
    await this.repository.saveNetwork(network);
    const results: PansConfigurationResult[] = [];
    for (const entry of devices) {
      await this.repository.saveDevice({
        ...entry.device,
        networkId: network.id,
      });
      await this.repository.associateDevice({
        networkId: network.id,
        deviceId: entry.device.id,
        associatedAt: this.now(),
      });
      results.push(
        await this.configuration.configureDevice(entry.device.id, {
          ...entry.config,
          panId: entry.config.panId ?? network.panId,
        }),
      );
    }
    return { network, results };
  }
}

function isExactPanConfiguration(
  result: PansConfigurationResult,
  expectedPanId: number,
): boolean {
  return (
    result.error === undefined &&
    result.inspected?.panId === expectedPanId &&
    result.writes
      .filter((write) => write.field === "panId")
      .every((write) => write.status === "verified")
  );
}

function assignmentBase(
  device: ManagedDevice,
  network: ManagedNetwork,
): Pick<
  AssignDeviceToNetworkProfileResult,
  "deviceId" | "targetNetworkId" | "previousNetworkId" | "device" | "network"
> {
  return {
    deviceId: device.id,
    targetNetworkId: network.id,
    ...(device.networkId ? { previousNetworkId: device.networkId } : {}),
    device,
    network,
  };
}

function assignmentFailure(
  deviceId: string,
  targetNetworkId: string,
  device: ManagedDevice | undefined,
  network: ManagedNetwork | undefined,
  stage: AssignDeviceToNetworkProfileStage,
  error: unknown,
): AssignDeviceToNetworkProfileResult {
  return {
    deviceId,
    targetNetworkId,
    ...(device?.networkId ? { previousNetworkId: device.networkId } : {}),
    stage,
    outcome: "failed",
    ...(device ? { device } : {}),
    ...(network ? { network } : {}),
    error: operationError(error, "assign network profile"),
  };
}

function operationError(
  error: unknown,
  operation: string,
): CommissioningOperationError {
  const normalized = normalizeManagerError(error, { operation });
  return { code: normalized.code, message: normalized.message };
}

function validateMigrationRetry(
  operation: PansBatchOperationRecord | undefined,
  networkId: string,
  targetPanId: number,
): void {
  if (!operation) return;
  if (
    operation.type !== "network-profile-pan-migration" ||
    operation.metadata?.networkId !== networkId ||
    operation.metadata?.targetPanId !== targetPanId
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "The operation ID already belongs to a different batch operation.",
    );
  }
}

function migrationMemberIds(
  operation: PansBatchOperationRecord | undefined,
): string[] | undefined {
  const value = operation?.metadata?.memberDeviceIds;
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? sortIds(value)
    : undefined;
}

function migrationDeviceResults(
  items: PansBatchOperationItem[],
  resolvedConfigurations: Map<string, PansConfigurationResult>,
  targetPanId: number,
): NetworkProfilePanMigrationDeviceResult[] {
  return items.map((item) => {
    const configuration =
      resolvedConfigurations.get(item.deviceId) ??
      (isConfigurationResult(item.result) ? item.result : undefined);
    if (
      item.status === "succeeded" &&
      configuration !== undefined &&
      isExactPanConfiguration(configuration, targetPanId)
    ) {
      return {
        deviceId: item.deviceId,
        outcome: "verified",
        ...(configuration ? { configuration } : {}),
      };
    }
    if (item.status === "skipped") {
      return {
        deviceId: item.deviceId,
        outcome: "cancelled",
        ...(configuration ? { configuration } : {}),
        ...(item.error ? { error: item.error } : {}),
      };
    }
    return {
      deviceId: item.deviceId,
      outcome: "failed",
      ...(configuration ? { configuration } : {}),
      ...(item.error
        ? { error: item.error }
        : {
            error: {
              code: "VERIFY_MISMATCH" as const,
              message:
                "The stored batch result did not verify the target PAN ID.",
            },
          }),
    };
  });
}

function isConfigurationResult(
  value: unknown,
): value is PansConfigurationResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<PansConfigurationResult>).deviceId === "string" &&
    Array.isArray((value as Partial<PansConfigurationResult>).writes)
  );
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
