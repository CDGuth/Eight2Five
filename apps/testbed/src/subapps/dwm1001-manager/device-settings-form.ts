import type {
  DeviceConfigurationDiff,
  HardwareDeviceChanges,
  ManagedDevice,
  ManagedDeviceConfig,
  PansInspectionResult,
} from "@eight2five/mobile/pans-manager";

export interface DeviceSettingsFormValues {
  advertisedName?: string;
  hardwareLabel?: string;
  panId?: number;
  role?: "anchor" | "tag";
  uwbMode?: "off" | "passive" | "active";
  selectedFirmware?: 1 | 2;
  ledEnabled?: boolean;
  firmwareUpdateEnabled?: boolean;
  initiatorEnabled?: boolean;
  positionX?: string;
  positionY?: string;
  positionZ?: string;
  positionQuality?: string;
  locationEngineEnabled?: boolean;
  lowPowerModeEnabled?: boolean;
  stationaryDetectionEnabled?: boolean;
  locationDataMode?: 0 | 1 | 2;
  movingUpdateRateMs?: number;
  stationaryUpdateRateMs?: number;
  source: "cached" | "actual";
  unavailableHardwareFields: string[];
}

export function deviceSettingsFormFrom(
  device: ManagedDevice,
  advertisedName?: string,
  config: ManagedDeviceConfig | undefined = device.lastKnownConfig,
): DeviceSettingsFormValues {
  const position = config?.role === "anchor" ? config.position : undefined;
  const tag = config?.role === "tag" ? config : undefined;
  return {
    ...(advertisedName ? { advertisedName } : {}),
    ...(config?.label !== undefined
      ? { hardwareLabel: config.label }
      : device.label !== undefined
        ? { hardwareLabel: device.label }
        : {}),
    ...(config?.panId !== undefined ? { panId: config.panId } : {}),
    ...(config?.role !== undefined ? { role: config.role } : {}),
    ...(config?.uwbMode !== undefined ? { uwbMode: config.uwbMode } : {}),
    ...(config?.selectedFirmware !== undefined
      ? { selectedFirmware: config.selectedFirmware }
      : {}),
    ...(config?.ledEnabled !== undefined
      ? { ledEnabled: config.ledEnabled }
      : {}),
    ...(config?.firmwareUpdateEnabled !== undefined
      ? { firmwareUpdateEnabled: config.firmwareUpdateEnabled }
      : {}),
    ...(config?.role === "anchor"
      ? { initiatorEnabled: config.initiatorEnabled }
      : {}),
    ...(position
      ? {
          positionX: String(position.xMeters),
          positionY: String(position.yMeters),
          positionZ: String(position.zMeters),
          positionQuality: String(position.quality),
        }
      : {}),
    ...(tag
      ? {
          locationEngineEnabled: tag.locationEngineEnabled,
          lowPowerModeEnabled: tag.lowPowerModeEnabled,
          stationaryDetectionEnabled: tag.stationaryDetectionEnabled,
          ...(tag.locationDataMode !== undefined
            ? { locationDataMode: tag.locationDataMode }
            : {}),
          ...(tag.movingUpdateRateMs !== undefined
            ? { movingUpdateRateMs: tag.movingUpdateRateMs }
            : {}),
          ...(tag.stationaryUpdateRateMs !== undefined
            ? { stationaryUpdateRateMs: tag.stationaryUpdateRateMs }
            : {}),
        }
      : {}),
    source: "cached",
    unavailableHardwareFields: [],
  };
}

export function mergeInspectionIntoDeviceSettingsForm(
  current: DeviceSettingsFormValues,
  inspection: PansInspectionResult,
): DeviceSettingsFormValues {
  const mode = inspection.operationMode;
  const unavailableHardwareFields = [
    ...(inspection.label === undefined ? ["label"] : []),
    ...(inspection.panId === undefined ? ["panId"] : []),
    ...(mode.role === "tag" && inspection.locationDataMode === undefined
      ? ["locationDataMode"]
      : []),
    ...(mode.role === "tag" && inspection.updateRate === undefined
      ? ["updateRate"]
      : []),
  ];
  return {
    ...current,
    ...(inspection.label !== undefined
      ? { hardwareLabel: inspection.label }
      : {}),
    ...(inspection.panId !== undefined ? { panId: inspection.panId } : {}),
    role: mode.role,
    uwbMode: mode.uwbMode,
    selectedFirmware: mode.selectedFirmware,
    ledEnabled: mode.ledEnabled,
    firmwareUpdateEnabled: mode.firmwareUpdateEnabled,
    ...(mode.role === "anchor"
      ? { initiatorEnabled: mode.initiatorEnabled }
      : {
          locationEngineEnabled: mode.locationEngineEnabled,
          lowPowerModeEnabled: mode.lowPowerModeEnabled,
          stationaryDetectionEnabled: mode.accelerometerEnabled,
          ...(inspection.locationDataMode !== undefined
            ? { locationDataMode: inspection.locationDataMode }
            : {}),
          ...(inspection.updateRate
            ? {
                movingUpdateRateMs: inspection.updateRate.movingUpdateRateMs,
                stationaryUpdateRateMs:
                  inspection.updateRate.stationaryUpdateRateMs,
              }
            : {}),
        }),
    source: "actual",
    unavailableHardwareFields,
  };
}

export function buildDeviceConfigurationDiff(
  baseline: DeviceSettingsFormValues,
  current: DeviceSettingsFormValues,
): DeviceConfigurationDiff {
  const localChanges: DeviceConfigurationDiff["localChanges"] = {};

  const hardwareChanges: HardwareDeviceChanges = {};
  addKnownChange(
    hardwareChanges,
    "label",
    baseline.hardwareLabel,
    current.hardwareLabel,
  );
  addKnownChange(hardwareChanges, "role", baseline.role, current.role);
  addKnownChange(hardwareChanges, "uwbMode", baseline.uwbMode, current.uwbMode);
  addKnownChange(
    hardwareChanges,
    "selectedFirmware",
    baseline.selectedFirmware,
    current.selectedFirmware,
  );
  addKnownChange(
    hardwareChanges,
    "ledEnabled",
    baseline.ledEnabled,
    current.ledEnabled,
  );
  addKnownChange(
    hardwareChanges,
    "firmwareUpdateEnabled",
    baseline.firmwareUpdateEnabled,
    current.firmwareUpdateEnabled,
  );

  if (baseline.role === current.role && current.role === "anchor") {
    addKnownChange(
      hardwareChanges,
      "initiatorEnabled",
      baseline.initiatorEnabled,
      current.initiatorEnabled,
    );
    const position = parseChangedPosition(baseline, current);
    if (position) hardwareChanges.position = position;
  }
  if (baseline.role === current.role && current.role === "tag") {
    addKnownChange(
      hardwareChanges,
      "locationEngineEnabled",
      baseline.locationEngineEnabled,
      current.locationEngineEnabled,
    );
    addKnownChange(
      hardwareChanges,
      "lowPowerModeEnabled",
      baseline.lowPowerModeEnabled,
      current.lowPowerModeEnabled,
    );
    addKnownChange(
      hardwareChanges,
      "stationaryDetectionEnabled",
      baseline.stationaryDetectionEnabled,
      current.stationaryDetectionEnabled,
    );
    addKnownChange(
      hardwareChanges,
      "locationDataMode",
      baseline.locationDataMode,
      current.locationDataMode,
    );
  }

  return { localChanges, hardwareChanges };
}

export function shouldAutoInspectDevice(
  isOpen: boolean,
  isAvailable: boolean,
  alreadyAttempted: boolean,
): boolean {
  return isOpen && isAvailable && !alreadyAttempted;
}

function addKnownChange<K extends keyof HardwareDeviceChanges>(
  changes: HardwareDeviceChanges,
  key: K,
  baseline: HardwareDeviceChanges[K] | undefined,
  current: HardwareDeviceChanges[K] | undefined,
): void {
  if (
    baseline !== undefined &&
    current !== undefined &&
    !valuesEqual(baseline, current)
  ) {
    changes[key] = current;
  }
}

function parseChangedPosition(
  baseline: DeviceSettingsFormValues,
  current: DeviceSettingsFormValues,
): HardwareDeviceChanges["position"] | undefined {
  const currentParts = [
    current.positionX,
    current.positionY,
    current.positionZ,
    current.positionQuality,
  ];
  if (currentParts.every((value) => value === undefined || value === ""))
    return undefined;
  if (
    currentParts.some((value) => value === undefined || value.trim() === "")
  ) {
    throw new Error("Enter X, Y, Z, and quality before writing a position.");
  }
  const baselineParts = [
    baseline.positionX,
    baseline.positionY,
    baseline.positionZ,
    baseline.positionQuality,
  ];
  if (currentParts.every((value, index) => value === baselineParts[index]))
    return undefined;
  const position = {
    xMeters: Number(current.positionX),
    yMeters: Number(current.positionY),
    zMeters: Number(current.positionZ),
    quality: Number(current.positionQuality),
  };
  if (
    !Number.isFinite(position.xMeters) ||
    !Number.isFinite(position.yMeters) ||
    !Number.isFinite(position.zMeters)
  ) {
    throw new Error("Position coordinates must be finite numbers.");
  }
  if (
    !Number.isInteger(position.quality) ||
    position.quality < 1 ||
    position.quality > 100
  ) {
    throw new Error("Position quality must be an integer from 1 to 100.");
  }
  return position;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
