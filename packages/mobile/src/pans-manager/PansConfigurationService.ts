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
  HardwareDeviceChanges,
  PansConfigurationResult,
  PansInspectionResult,
  VerifiedWrite,
} from "./types";
import {
  assertPanId,
  assertValidLabel,
  assertValidPosition,
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

  /** Refreshes the hardware cache while retaining optional values that cannot be read. */
  async inspectAndCache(deviceId: string): Promise<PansInspectionResult> {
    const device = await this.requireDevice(deviceId);
    const inspection = await this.sessions.withConnectedDevice(
      device.transportDeviceId,
      async (session) => await inspectConnected(session, device.id, this.now),
    );
    const config = configFromInspection(inspection, device.lastKnownConfig);
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
      const config = configFromInspection(result, device.lastKnownConfig);
      if (
        config.role === "anchor" &&
        device.lastKnownConfig?.role === "anchor" &&
        device.lastKnownConfig.position
      ) {
        config.position = device.lastKnownConfig.position;
      }
      const panWrite = writes.find((write) => write.field === "panId");
      const persistedPanId =
        typeof panWrite?.actual === "number" ? panWrite.actual : config.panId;
      await this.persistConfiguration(
        device,
        {
          ...config,
          ...(persistedPanId !== undefined ? { panId: persistedPanId } : {}),
        },
        result,
      );
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

  /** Applies only caller-declared dirty hardware fields. PAN and update rates are not accepted. */
  async applyConfigurationDiff(
    deviceId: string,
    hardwareChanges: HardwareDeviceChanges,
  ): Promise<PansConfigurationResult> {
    const device = await this.requireDevice(deviceId);
    const writes: VerifiedWrite[] = [];
    const warnings: string[] = [];
    let inspected: PansInspectionResult | undefined;
    let successfulPosition: ManagedAnchorConfig["position"];
    let didWrite = false;

    try {
      const finalInspection = await this.sessions.withConnectedDevice(
        device.transportDeviceId,
        async (session) => {
          inspected = await inspectConnected(session, device.id, this.now);
          warnings.push(...inspected.warnings);
          validateHardwareChanges(
            hardwareChanges,
            inspected.operationMode.role,
          );

          if (hasOwn(hardwareChanges, "label")) {
            const requested = hardwareChanges.label!;
            if (requested === inspected.label) {
              writes.push(verified("label", requested, inspected.label));
            } else {
              try {
                requireWrite(
                  await session.writeLabel(requested),
                  "label",
                  deviceId,
                );
                didWrite = true;
                const actual = await optionalRead(
                  () => session.readLabel(),
                  "label readback",
                  warnings,
                );
                writes.push(verifiableWrite("label", requested, actual));
                if (actual !== undefined)
                  inspected = { ...inspected, label: actual };
              } catch (error) {
                writes.push(failedWrite("label", requested, error));
                throw error;
              }
            }
          }

          const modePatch = buildSparseModePatch(
            hardwareChanges,
            inspected.operationMode,
          );
          const requestedModeFields = sparseModeFields(hardwareChanges);
          if (Object.keys(modePatch).length) {
            try {
              await session.patchOperationMode(modePatch);
              didWrite = true;
              const actual = await session.readOperationMode();
              inspected = { ...inspected, operationMode: actual };
              for (const field of requestedModeFields) {
                writes.push(
                  verified(
                    field.changeKey,
                    field.requested,
                    actual[field.modeKey],
                  ),
                );
              }
            } catch (error) {
              for (const field of requestedModeFields) {
                if (hasOwn(modePatch, field.modeKey)) {
                  writes.push(
                    failedWrite(field.changeKey, field.requested, error),
                  );
                }
              }
              throw error;
            }
          } else {
            for (const field of requestedModeFields) {
              writes.push(
                verified(
                  field.changeKey,
                  field.requested,
                  inspected.operationMode[field.modeKey],
                ),
              );
            }
          }

          if (hasOwn(hardwareChanges, "locationDataMode")) {
            const requested = hardwareChanges.locationDataMode!;
            if (requested === inspected.locationDataMode) {
              writes.push(
                verified(
                  "locationDataMode",
                  requested,
                  inspected.locationDataMode,
                ),
              );
            } else {
              try {
                requireWrite(
                  await session.writeLocationDataMode(requested),
                  "location data mode",
                  deviceId,
                );
                didWrite = true;
                const actual = await optionalRead(
                  () => session.readLocationDataMode(),
                  "location data mode readback",
                  warnings,
                );
                writes.push(
                  verifiableWrite("locationDataMode", requested, actual),
                );
                if (actual !== undefined)
                  inspected = { ...inspected, locationDataMode: actual };
              } catch (error) {
                writes.push(failedWrite("locationDataMode", requested, error));
                throw error;
              }
            }
          }

          if (hasOwn(hardwareChanges, "position")) {
            const requested = hardwareChanges.position!;
            try {
              requireWrite(
                await session.writePersistedPosition(requested),
                "persisted position",
                deviceId,
              );
              didWrite = true;
              successfulPosition = requested;
              const warning =
                "Persisted position is write-only and cannot be read back.";
              writes.push({
                field: "position",
                status: "written-unverified",
                requested,
                warning,
              });
              warnings.push(warning);
            } catch (error) {
              writes.push(failedWrite("position", requested, error));
              throw error;
            }
          }

          const actual = await inspectConnected(session, device.id, this.now);
          inspected = mergeInspectionObservations(actual, inspected);
          warnings.push(
            ...actual.warnings.filter((warning) => !warnings.includes(warning)),
          );
          return inspected;
        },
      );

      const persistedConfig = configFromInspection(
        finalInspection,
        device.lastKnownConfig,
      );
      preserveKnownAnchorPosition(
        persistedConfig,
        successfulPosition,
        device.lastKnownConfig,
      );
      await this.persistInspection(device, persistedConfig, finalInspection);
      const partial =
        warnings.length > 0 ||
        writes.some((write) => write.status !== "verified");
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: partial ? "partial" : "verified",
        inspected: finalInspection,
        writes,
        warnings,
      };
    } catch (error) {
      const normalized = normalizeManagerError(error, {
        deviceId,
        operation: "apply configuration diff",
      });
      if (inspected && didWrite) {
        const persistedConfig = configFromInspection(
          inspected,
          device.lastKnownConfig,
        );
        preserveKnownAnchorPosition(
          persistedConfig,
          successfulPosition,
          device.lastKnownConfig,
        );
        try {
          await this.persistInspection(device, persistedConfig, inspected);
        } catch (persistenceError) {
          const storage = normalizeManagerError(persistenceError, {
            deviceId,
            operation: "persist partial configuration",
          });
          return {
            deviceId,
            transportDeviceId: device.transportDeviceId,
            outcome: "partial",
            inspected,
            writes,
            warnings,
            error: { code: storage.code, message: storage.message },
          };
        }
      }
      return {
        deviceId,
        transportDeviceId: device.transportDeviceId,
        outcome: didWrite ? "partial" : "failure",
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

          const modePatch = buildModePatch(config, inspected.operationMode);
          if (Object.keys(modePatch).length) {
            await session.patchOperationMode(modePatch);
            const actual = await session.readOperationMode();
            writes.push(verifiedMode(modePatch, actual));
          }

          if (
            config.role === "tag" &&
            config.locationDataMode !== undefined &&
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
      const latestDevice = await this.repository.getDevice(device.id);
      if (!latestDevice) {
        throw new ManagerError(
          "DEVICE_NOT_FOUND",
          "The managed device disappeared before its configuration could be saved.",
          { deviceId: device.id, operation: "persist configuration" },
        );
      }
      await this.repository.saveDevice({
        ...latestDevice,
        label: inspection.label ?? persistedConfig.label ?? latestDevice.label,
        role: inspection.operationMode.role,
        nodeIdHex: inspection.deviceInfo?.nodeIdHex ?? latestDevice.nodeIdHex,
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

type EditableModeKey =
  | "role"
  | "uwbMode"
  | "selectedFirmware"
  | "ledEnabled"
  | "firmwareUpdateEnabled"
  | "initiatorEnabled"
  | "locationEngineEnabled"
  | "lowPowerModeEnabled"
  | "accelerometerEnabled";

interface SparseModeField {
  changeKey: keyof HardwareDeviceChanges;
  modeKey: EditableModeKey;
  requested: unknown;
}

function sparseModeFields(changes: HardwareDeviceChanges): SparseModeField[] {
  const mapping: [keyof HardwareDeviceChanges, EditableModeKey][] = [
    ["role", "role"],
    ["uwbMode", "uwbMode"],
    ["selectedFirmware", "selectedFirmware"],
    ["ledEnabled", "ledEnabled"],
    ["firmwareUpdateEnabled", "firmwareUpdateEnabled"],
    ["initiatorEnabled", "initiatorEnabled"],
    ["locationEngineEnabled", "locationEngineEnabled"],
    ["lowPowerModeEnabled", "lowPowerModeEnabled"],
    ["stationaryDetectionEnabled", "accelerometerEnabled"],
  ];
  return mapping
    .filter(([changeKey]) => hasOwn(changes, changeKey))
    .map(([changeKey, modeKey]) => ({
      changeKey,
      modeKey,
      requested: changes[changeKey],
    }));
}

function buildSparseModePatch(
  changes: HardwareDeviceChanges,
  current: PansInspectionResult["operationMode"],
): PansOperationModePatch {
  return Object.fromEntries(
    sparseModeFields(changes)
      .filter((field) => !Object.is(current[field.modeKey], field.requested))
      .map((field) => [field.modeKey, field.requested]),
  ) as PansOperationModePatch;
}

function validateHardwareChanges(
  changes: HardwareDeviceChanges,
  currentRole: PansInspectionResult["operationMode"]["role"],
): void {
  const record = changes as Record<string, unknown>;
  if (
    hasOwn(record, "panId") ||
    hasOwn(record, "movingUpdateRateMs") ||
    hasOwn(record, "stationaryUpdateRateMs")
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "PAN ID and tag update rates cannot be changed through a device configuration diff.",
    );
  }
  const supportedFields = new Set<keyof HardwareDeviceChanges>([
    "label",
    "role",
    "uwbMode",
    "selectedFirmware",
    "ledEnabled",
    "firmwareUpdateEnabled",
    "initiatorEnabled",
    "position",
    "locationEngineEnabled",
    "lowPowerModeEnabled",
    "stationaryDetectionEnabled",
    "locationDataMode",
  ]);
  const unknownField = Object.keys(record).find(
    (key) => !supportedFields.has(key as keyof HardwareDeviceChanges),
  );
  if (unknownField) invalidHardwareField(unknownField);
  if (hasOwn(changes, "label")) {
    if (typeof changes.label !== "string") invalidHardwareField("label");
    assertValidLabel(changes.label);
  }
  if (
    hasOwn(changes, "role") &&
    changes.role !== "tag" &&
    changes.role !== "anchor"
  )
    invalidHardwareField("role");
  if (
    hasOwn(changes, "uwbMode") &&
    changes.uwbMode !== "off" &&
    changes.uwbMode !== "passive" &&
    changes.uwbMode !== "active"
  )
    invalidHardwareField("UWB mode");
  if (
    hasOwn(changes, "selectedFirmware") &&
    changes.selectedFirmware !== 1 &&
    changes.selectedFirmware !== 2
  )
    invalidHardwareField("selected firmware");
  for (const key of [
    "ledEnabled",
    "firmwareUpdateEnabled",
    "initiatorEnabled",
    "locationEngineEnabled",
    "lowPowerModeEnabled",
    "stationaryDetectionEnabled",
  ] as const) {
    if (hasOwn(changes, key) && typeof changes[key] !== "boolean")
      invalidHardwareField(key);
  }
  if (
    hasOwn(changes, "locationDataMode") &&
    changes.locationDataMode !== 0 &&
    changes.locationDataMode !== 1 &&
    changes.locationDataMode !== 2
  )
    invalidHardwareField("location data mode");
  if (hasOwn(changes, "position")) {
    if (!changes.position || typeof changes.position !== "object")
      invalidHardwareField("position");
    assertValidPosition(changes.position);
  }

  const targetRole = changes.role ?? currentRole;
  const hasAnchorField =
    hasOwn(changes, "initiatorEnabled") || hasOwn(changes, "position");
  const hasTagField =
    hasOwn(changes, "locationEngineEnabled") ||
    hasOwn(changes, "lowPowerModeEnabled") ||
    hasOwn(changes, "stationaryDetectionEnabled") ||
    hasOwn(changes, "locationDataMode");
  if (targetRole === "tag" && hasAnchorField) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Anchor-only fields cannot be applied to a tag.",
    );
  }
  if (targetRole === "anchor" && hasTagField) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Tag-only fields cannot be applied to an anchor.",
    );
  }
}

function invalidHardwareField(field: string): never {
  throw new ManagerError(
    "INVALID_CONFIGURATION",
    `The provided ${field} value is invalid.`,
  );
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function failedWrite(
  field: string,
  requested: unknown,
  error: unknown,
): VerifiedWrite {
  const normalized = normalizeManagerError(error, {
    operation: `write ${field}`,
  });
  return {
    field,
    status: "failed",
    requested,
    warning: normalized.message,
    errorCode: normalized.code,
  };
}

function verifiableWrite(
  field: string,
  requested: unknown,
  actual: unknown,
): VerifiedWrite {
  if (actual !== undefined) return verified(field, requested, actual);
  return {
    field,
    status: "written-unverified",
    requested,
    warning: `${field} was written but readback is unavailable.`,
  };
}

function preserveKnownAnchorPosition(
  config: ManagedDeviceConfig,
  newlyWritten: ManagedAnchorConfig["position"],
  previous: ManagedDeviceConfig | undefined,
): void {
  if (config.role !== "anchor") return;
  const position =
    newlyWritten ??
    (previous?.role === "anchor" ? previous.position : undefined);
  if (position) config.position = position;
}

function mergeInspectionObservations(
  finalInspection: PansInspectionResult,
  priorInspection: PansInspectionResult,
): PansInspectionResult {
  return {
    ...finalInspection,
    ...(finalInspection.label === undefined &&
    priorInspection.label !== undefined
      ? { label: priorInspection.label }
      : {}),
    ...(finalInspection.panId === undefined &&
    priorInspection.panId !== undefined
      ? { panId: priorInspection.panId }
      : {}),
    ...(finalInspection.locationDataMode === undefined &&
    priorInspection.locationDataMode !== undefined
      ? { locationDataMode: priorInspection.locationDataMode }
      : {}),
    ...(finalInspection.updateRate === undefined &&
    priorInspection.updateRate !== undefined
      ? { updateRate: priorInspection.updateRate }
      : {}),
    ...(finalInspection.deviceInfo === undefined &&
    priorInspection.deviceInfo !== undefined
      ? { deviceInfo: priorInspection.deviceInfo }
      : {}),
  };
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
    ...(config.selectedFirmware !== undefined
      ? { selectedFirmware: config.selectedFirmware }
      : {}),
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
    selectedFirmware: mode.selectedFirmware,
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
