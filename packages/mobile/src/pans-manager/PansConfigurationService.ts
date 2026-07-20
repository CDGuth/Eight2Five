import type { PansOperationModePatch } from "expo-pans-ble-api";
import { ManagerError, normalizeManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import type { ConnectedPansSession } from "./PansDeviceSessionManager";
import { PansDeviceSessionManager } from "./PansDeviceSessionManager";
import type {
  ManagedAnchorConfig,
  ManagedDevice,
  ManagedDeviceConfig,
  ManagedTagConfig,
  PansConfigurationResult,
  PansInspectionResult,
  VerifiedWrite,
} from "./types";
import {
  assertPanId,
  assertValidLabel,
  normalizeDeviceConfig,
} from "./validation";

export class PansConfigurationService {
  constructor(
    private readonly sessions: PansDeviceSessionManager,
    private readonly repository: PansManagerRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async inspect(deviceId: string): Promise<PansInspectionResult> {
    const device = await this.requireDevice(deviceId);
    return await this.sessions.withConnectedDevice(
      device.transportDeviceId,
      async (session) => await inspectConnected(session, device.id, this.now),
    );
  }

  /** Reads hardware and explicitly replaces the persisted inspection cache. */
  async inspectAndCache(deviceId: string): Promise<PansInspectionResult> {
    const device = await this.requireDevice(deviceId);
    const inspection = await this.sessions.withConnectedDevice(
      device.transportDeviceId,
      async (session) => await inspectConnected(session, device.id, this.now),
    );
    const config = configFromInspection(inspection);
    if (
      config.role === "anchor" &&
      device.lastKnownConfig?.role === "anchor" &&
      device.lastKnownConfig.position
    ) {
      // PANS exposes position as a write-only characteristic. A fresh read must
      // not discard the last position the app successfully wrote.
      config.position = device.lastKnownConfig.position;
    }
    await this.persistInspection(device, config, inspection);
    return inspection;
  }

  async inspectDevice(deviceId: string): Promise<PansInspectionResult> {
    return await this.inspect(deviceId);
  }

  async configureAnchor(
    deviceId: string,
    config: ManagedAnchorConfig,
  ): Promise<PansConfigurationResult> {
    return await this.configureDevice(deviceId, config);
  }

  async configureTag(
    deviceId: string,
    config: ManagedTagConfig,
  ): Promise<PansConfigurationResult> {
    return await this.configureDevice(deviceId, config);
  }

  async assignPanId(
    deviceId: string,
    panId: number,
  ): Promise<PansConfigurationResult> {
    assertPanId(panId);
    const device = await this.requireDevice(deviceId);
    const writes: VerifiedWrite[] = [];
    const warnings: string[] = [];
    let inspected: PansInspectionResult | undefined;
    try {
      const result = await this.sessions.withConnectedDevice(
        device.transportDeviceId,
        async (session) => {
          const before = await inspectConnected(session, device.id, this.now);
          inspected = before;
          warnings.push(...before.warnings);
          if (before.panId !== panId) {
            requireWrite(
              await session.writeNetworkId(panId),
              "PAN ID",
              deviceId,
            );
            const actual = await session.readNetworkId();
            writes.push(verified("panId", panId, actual));
          }
          return await inspectConnected(session, device.id, this.now);
        },
      );
      inspected = result;
      warnings.push(
        ...result.warnings.filter((warning) => !warnings.includes(warning)),
      );
      const config = configFromInspection(result);
      if (
        config.role === "anchor" &&
        device.lastKnownConfig?.role === "anchor" &&
        device.lastKnownConfig.position
      ) {
        config.position = device.lastKnownConfig.position;
      }
      await this.persistConfiguration(device, { ...config, panId }, result);
      const mismatch = writes.some((write) => write.status !== "verified");
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: mismatch || warnings.length ? "partial" : "verified",
        inspected: result,
        writes,
        warnings,
        ...(mismatch
          ? {
              error: {
                code: "VERIFY_MISMATCH" as const,
                message: "PAN ID readback did not match the requested value.",
              },
            }
          : {}),
      };
    } catch (error) {
      const normalized = normalizeManagerError(error, {
        deviceId,
        operation: "assignPanId",
      });
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: writes.length ? "partial" : "failure",
        ...(inspected ? { inspected } : {}),
        writes,
        warnings,
        error: { code: normalized.code, message: normalized.message },
      };
    }
  }

  async writeLabel(
    deviceId: string,
    label: string,
  ): Promise<PansConfigurationResult> {
    assertValidLabel(label);
    const device = await this.requireDevice(deviceId);
    const config =
      device.lastKnownConfig ??
      configFromInspection(await this.inspect(deviceId));
    return await this.configureDevice(deviceId, { ...config, label });
  }

  async configureDevice(
    deviceId: string,
    requested: ManagedDeviceConfig,
  ): Promise<PansConfigurationResult> {
    const config = normalizeDeviceConfig(requested);
    const device = await this.requireDevice(deviceId);
    const writes: VerifiedWrite[] = [];
    const warnings: string[] = [];
    let inspected: PansInspectionResult | undefined;

    try {
      const result = await this.sessions.withConnectedDevice(
        device.transportDeviceId,
        async (session) => {
          inspected = await inspectConnected(session, device.id, this.now);
          warnings.push(...inspected.warnings);

          if (
            config.role === "tag" &&
            updateRateChangeRequested(config, inspected)
          ) {
            throw new ManagerError(
              "UNSUPPORTED_FEATURE",
              "Writing tag update rates requires a native API extension.",
              { deviceId, operation: "configureTag" },
            );
          }

          if (config.label !== undefined && config.label !== inspected.label) {
            requireWrite(
              await session.writeLabel(config.label),
              "label",
              deviceId,
            );
            const actual = await optionalRead(
              () => session.readLabel(),
              "label readback",
              warnings,
            );
            writes.push(verified("label", config.label, actual));
          }

          if (config.panId !== undefined && config.panId !== inspected.panId) {
            requireWrite(
              await session.writeNetworkId(config.panId),
              "PAN ID",
              deviceId,
            );
            const actual = await optionalRead(
              () => session.readNetworkId(),
              "PAN ID readback",
              warnings,
            );
            writes.push(verified("panId", config.panId, actual));
          }

          const modePatch = buildModePatch(config, inspected.operationMode);
          if (Object.keys(modePatch).length) {
            await session.patchOperationMode(modePatch);
            const actual = await session.readOperationMode();
            writes.push(verifiedMode(modePatch, actual));
          }

          if (
            config.role === "tag" &&
            config.locationDataMode !== inspected.locationDataMode
          ) {
            requireWrite(
              await session.writeLocationDataMode(config.locationDataMode),
              "location data mode",
              deviceId,
            );
            const actual = await optionalRead(
              () => session.readLocationDataMode(),
              "location data mode readback",
              warnings,
            );
            writes.push(
              verified("locationDataMode", config.locationDataMode, actual),
            );
          }

          if (
            config.role === "anchor" &&
            config.position &&
            !positionsEqual(
              config.position,
              device.lastKnownConfig?.role === "anchor"
                ? device.lastKnownConfig.position
                : undefined,
            )
          ) {
            requireWrite(
              await session.writePersistedPosition(config.position),
              "persisted position",
              deviceId,
            );
            const warning =
              "Persisted position cannot be read back by the native API.";
            writes.push({
              field: "position",
              status: "written-unverified",
              requested: config.position,
              warning,
            });
            warnings.push(warning);
          }

          return await inspectConnected(session, device.id, this.now);
        },
      );
      inspected = result;
      warnings.push(
        ...result.warnings.filter((warning) => !warnings.includes(warning)),
      );
      const partial =
        writes.some((write) => write.status !== "verified") ||
        warnings.length > 0;
      await this.persistConfiguration(device, config, result);
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: partial ? "partial" : "verified",
        inspected: result,
        writes,
        warnings,
      };
    } catch (error) {
      const normalized = normalizeManagerError(error, {
        deviceId,
        operation: "configureDevice",
      });
      if (writes.length && inspected) {
        await this.persistConfiguration(device, config, inspected);
      }
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: writes.length ? "partial" : "failure",
        ...(inspected ? { inspected } : {}),
        writes,
        warnings,
        error: { code: normalized.code, message: normalized.message },
      };
    }
  }

  private async requireDevice(id: string): Promise<ManagedDevice> {
    const device = await this.repository.getDevice(id);
    if (!device) {
      throw new ManagerError(
        "DEVICE_NOT_FOUND",
        "The managed device does not exist.",
        {
          deviceId: id,
        },
      );
    }
    return device;
  }

  private async persistConfiguration(
    device: ManagedDevice,
    config: ManagedDeviceConfig,
    inspection: PansInspectionResult,
  ): Promise<void> {
    const requestedCache = mergePersistedConfig(device.lastKnownConfig, config);
    const persistedConfig = configFromInspection(inspection, requestedCache);
    await this.persistInspection(device, persistedConfig, inspection);
  }

  private async persistInspection(
    device: ManagedDevice,
    persistedConfig: ManagedDeviceConfig,
    inspection: PansInspectionResult,
  ): Promise<void> {
    const updatedAt = this.now();
    try {
      await this.repository.saveDevice({
        ...device,
        label: inspection.label ?? persistedConfig.label ?? device.label,
        role: inspection.operationMode.role,
        nodeIdHex: inspection.deviceInfo?.nodeIdHex ?? device.nodeIdHex,
        lastKnownConfig: persistedConfig,
        updatedAt,
      });
      await this.repository.saveDeviceSnapshot({
        deviceId: device.id,
        capturedAt: updatedAt,
        config: persistedConfig,
        inspection,
      });
    } catch (cause) {
      throw new ManagerError(
        "STORAGE_FAILURE",
        "The device configuration cache could not be saved.",
        { deviceId: device.id, operation: "persist configuration", cause },
      );
    }
  }
}

function mergePersistedConfig(
  previous: ManagedDeviceConfig | undefined,
  next: ManagedDeviceConfig,
): ManagedDeviceConfig {
  if (!previous || previous.role !== next.role) return next;
  return { ...previous, ...next } as ManagedDeviceConfig;
}

function positionsEqual(
  left: ManagedAnchorConfig["position"],
  right: ManagedAnchorConfig["position"],
): boolean {
  return (
    left?.xMeters === right?.xMeters &&
    left?.yMeters === right?.yMeters &&
    left?.zMeters === right?.zMeters &&
    left?.quality === right?.quality
  );
}

async function inspectConnected(
  session: ConnectedPansSession,
  deviceId: string,
  now: () => number,
): Promise<PansInspectionResult> {
  const warnings: string[] = [];
  const operationMode = await session.readOperationMode();
  const label = await optionalRead(
    () => session.readLabel(),
    "label",
    warnings,
  );
  const panId = await optionalRead(
    () => session.readNetworkId(),
    "PAN ID",
    warnings,
  );
  const deviceInfo = await optionalRead(
    () => session.readDeviceInfo(),
    "device information",
    warnings,
  );
  if (operationMode.role === "tag") {
    const locationDataMode = await optionalRead(
      () => session.readLocationDataMode(),
      "location data mode",
      warnings,
    );
    const updateRate = await optionalRead(
      () => session.readTagUpdateRate(),
      "tag update rate",
      warnings,
    );
    return {
      deviceId,
      transportDeviceId: session.transportDeviceId,
      inspectedAt: now(),
      ...(label !== undefined ? { label } : {}),
      ...(panId !== undefined ? { panId } : {}),
      operationMode,
      ...(locationDataMode !== undefined ? { locationDataMode } : {}),
      ...(updateRate !== undefined ? { updateRate } : {}),
      ...(deviceInfo !== undefined ? { deviceInfo } : {}),
      warnings,
    };
  }
  return {
    deviceId,
    transportDeviceId: session.transportDeviceId,
    inspectedAt: now(),
    ...(label !== undefined ? { label } : {}),
    ...(panId !== undefined ? { panId } : {}),
    operationMode,
    ...(deviceInfo !== undefined ? { deviceInfo } : {}),
    warnings,
  };
}

async function optionalRead<T>(
  read: () => Promise<T>,
  field: string,
  warnings: string[],
): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    const normalized = normalizeManagerError(error, {
      operation: `read ${field}`,
    });
    if (
      normalized.code !== "MISSING_CHARACTERISTIC" &&
      normalized.code !== "UNSUPPORTED_FEATURE" &&
      normalized.code !== "INCOMPATIBLE_FIRMWARE"
    ) {
      throw normalized;
    }
    warnings.push(`${field} is unavailable on this device.`);
    return undefined;
  }
}

function buildModePatch(
  config: ManagedDeviceConfig,
  current: PansInspectionResult["operationMode"],
): PansOperationModePatch {
  const desired: PansOperationModePatch = {
    role: config.role,
    uwbMode: config.uwbMode,
    ledEnabled: config.ledEnabled,
    firmwareUpdateEnabled: config.firmwareUpdateEnabled,
    ...(config.role === "tag"
      ? {
          accelerometerEnabled: config.stationaryDetectionEnabled,
          lowPowerModeEnabled: config.lowPowerModeEnabled,
          locationEngineEnabled: config.locationEngineEnabled,
          initiatorEnabled: false,
        }
      : {
          initiatorEnabled: config.initiatorEnabled,
          lowPowerModeEnabled: false,
          locationEngineEnabled: false,
        }),
  };
  return Object.fromEntries(
    Object.entries(desired).filter(
      ([key, value]) => current[key as keyof typeof current] !== value,
    ),
  ) as PansOperationModePatch;
}

function updateRateChangeRequested(
  config: ManagedTagConfig,
  inspection: PansInspectionResult,
): boolean {
  return (
    (config.movingUpdateRateMs !== undefined &&
      config.movingUpdateRateMs !==
        inspection.updateRate?.movingUpdateRateMs) ||
    (config.stationaryUpdateRateMs !== undefined &&
      config.stationaryUpdateRateMs !==
        inspection.updateRate?.stationaryUpdateRateMs)
  );
}

function verified(
  field: string,
  requested: unknown,
  actual: unknown,
): VerifiedWrite {
  return Object.is(requested, actual)
    ? { field, status: "verified", requested, actual }
    : {
        field,
        status: "mismatch",
        requested,
        actual,
        warning: "Readback did not match the requested value.",
        errorCode: "VERIFY_MISMATCH",
      };
}

function verifiedMode(
  patch: PansOperationModePatch,
  actual: PansInspectionResult["operationMode"],
): VerifiedWrite {
  const matches = Object.entries(patch).every(
    ([key, value]) => actual[key as keyof typeof actual] === value,
  );
  return {
    field: "operationMode",
    status: matches ? "verified" : "mismatch",
    requested: patch,
    actual,
    ...(!matches
      ? {
          warning: "Operation-mode readback did not match the requested flags.",
          errorCode: "VERIFY_MISMATCH",
        }
      : {}),
  };
}

function requireWrite(ok: boolean, field: string, deviceId: string): void {
  if (!ok) {
    throw new ManagerError("WRITE_FAILED", `Failed to write ${field}.`, {
      deviceId,
      operation: `write ${field}`,
      isRetryable: true,
    });
  }
}

function configFromInspection(
  inspection: PansInspectionResult,
  fallback?: ManagedDeviceConfig,
): ManagedDeviceConfig {
  const mode = inspection.operationMode;
  const common = {
    ...(inspection.label !== undefined
      ? { label: inspection.label }
      : fallback?.label !== undefined
        ? { label: fallback.label }
        : {}),
    ...(inspection.panId !== undefined
      ? { panId: inspection.panId }
      : fallback?.panId !== undefined
        ? { panId: fallback.panId }
        : {}),
    uwbMode: mode.uwbMode,
    ledEnabled: mode.ledEnabled,
    firmwareUpdateEnabled: mode.firmwareUpdateEnabled,
  };
  if (mode.role === "anchor") {
    return {
      ...common,
      role: "anchor",
      initiatorEnabled: mode.initiatorEnabled,
      ...(fallback?.role === "anchor" && fallback.position
        ? { position: fallback.position }
        : {}),
    };
  }
  return {
    ...common,
    role: "tag",
    locationEngineEnabled: mode.locationEngineEnabled,
    lowPowerModeEnabled: mode.lowPowerModeEnabled,
    stationaryDetectionEnabled: mode.accelerometerEnabled,
    ...(inspection.locationDataMode !== undefined
      ? { locationDataMode: inspection.locationDataMode }
      : fallback?.role === "tag"
        ? { locationDataMode: fallback.locationDataMode }
        : {}),
    ...(inspection.updateRate
      ? {
          movingUpdateRateMs: inspection.updateRate.movingUpdateRateMs,
          stationaryUpdateRateMs: inspection.updateRate.stationaryUpdateRateMs,
        }
      : fallback?.role === "tag"
        ? {
            ...(fallback.movingUpdateRateMs !== undefined
              ? { movingUpdateRateMs: fallback.movingUpdateRateMs }
              : {}),
            ...(fallback.stationaryUpdateRateMs !== undefined
              ? { stationaryUpdateRateMs: fallback.stationaryUpdateRateMs }
              : {}),
          }
        : {}),
  } as ManagedDeviceConfig;
}
