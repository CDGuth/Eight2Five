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

export interface DeviceSettingsFieldErrors {
  positionX?: string;
  positionY?: string;
  positionZ?: string;
  positionQuality?: string;
}

export function validateAnchorPositionFields(
  current: DeviceSettingsFormValues,
): DeviceSettingsFieldErrors {
  const errors: DeviceSettingsFieldErrors = {};
  const coordinates = [
    ["positionX", current.positionX],
    ["positionY", current.positionY],
    ["positionZ", current.positionZ],
  ] as const;
  const coordinateText = coordinates.map(([, value]) => value?.trim() ?? "");
  const qualityText = current.positionQuality?.trim() ?? "";

  if (coordinateText.every((value) => value === "") && qualityText === "")
    return errors;

  for (const [field, value] of coordinates) {
    const text = value?.trim() ?? "";
    if (text === "") errors[field] = "Required when writing a position.";
    else if (!Number.isFinite(Number(text)))
      errors[field] = "Enter a finite number in meters.";
  }

  if (qualityText !== "") {
    const quality = Number(qualityText);
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      errors.positionQuality =
        "Enter an integer from 1 to 100, or leave blank for 100.";
    }
  }

  return errors;
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
  const currentCoordinateText = [
    current.positionX?.trim() ?? "",
    current.positionY?.trim() ?? "",
    current.positionZ?.trim() ?? "",
  ];
  const currentQualityText = current.positionQuality?.trim() ?? "";
  if (
    currentCoordinateText.every((value) => value === "") &&
    currentQualityText === ""
  )
    return undefined;

  const errors = validateAnchorPositionFields(current);
  const firstError =
    errors.positionX ??
    errors.positionY ??
    errors.positionZ ??
    errors.positionQuality;
  if (firstError) throw new Error(firstError);

  const position = {
    xMeters: Number(currentCoordinateText[0]),
    yMeters: Number(currentCoordinateText[1]),
    zMeters: Number(currentCoordinateText[2]),
    quality: currentQualityText === "" ? 100 : Number(currentQualityText),
  };
  const baselinePosition = parseComparablePosition(baseline);
  if (baselinePosition && valuesEqual(position, baselinePosition))
    return undefined;
  return position;
}

function parseComparablePosition(
  form: DeviceSettingsFormValues,
): HardwareDeviceChanges["position"] | undefined {
  const coordinates = [form.positionX, form.positionY, form.positionZ];
  if (coordinates.some((value) => value === undefined || value.trim() === ""))
    return undefined;
  const qualityText = form.positionQuality?.trim() ?? "";
  const position = {
    xMeters: Number(form.positionX),
    yMeters: Number(form.positionY),
    zMeters: Number(form.positionZ),
    quality: qualityText === "" ? 100 : Number(qualityText),
  };
  return Number.isFinite(position.xMeters) &&
    Number.isFinite(position.yMeters) &&
    Number.isFinite(position.zMeters) &&
    Number.isInteger(position.quality) &&
    position.quality >= 1 &&
    position.quality <= 100
    ? position
    : undefined;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
