import type { ManagedNetworkSettings } from "@eight2five/mobile/pans-manager";

export interface NetworkSettingsFormState {
  minXMeters: string;
  maxXMeters: string;
  minYMeters: string;
  maxYMeters: string;
  minZMeters: string;
  maxZMeters: string;
  defaultAnchorHeightMeters: string;
  staleDeviceTimeoutSeconds: string;
  movingUpdateRateMs: string;
  stationaryUpdateRateMs: string;
  scanDurationSeconds: string;
  autoConnect: boolean;
  positionLogRetentionDays: string;
  positionLogMaxSamples: string;
  locationEngineEnabled: boolean;
  lowPowerModeEnabled: boolean;
  stationaryDetectionEnabled: boolean;
  locationDataMode: ManagedNetworkSettings["defaultTagMode"]["locationDataMode"];
}

export type NetworkSettingsFormResult =
  | { settings: ManagedNetworkSettings; error?: never }
  | { settings?: never; error: string };

export function networkSettingsToForm(
  settings: ManagedNetworkSettings,
): NetworkSettingsFormState {
  return {
    minXMeters: String(settings.coordinateBounds.minXMeters),
    maxXMeters: String(settings.coordinateBounds.maxXMeters),
    minYMeters: String(settings.coordinateBounds.minYMeters),
    maxYMeters: String(settings.coordinateBounds.maxYMeters),
    minZMeters: String(settings.coordinateBounds.minZMeters),
    maxZMeters: String(settings.coordinateBounds.maxZMeters),
    defaultAnchorHeightMeters: String(settings.defaultAnchorHeightMeters),
    staleDeviceTimeoutSeconds: String(settings.staleDeviceTimeoutMs / 1_000),
    movingUpdateRateMs: String(settings.defaultTagMode.movingUpdateRateMs),
    stationaryUpdateRateMs: String(
      settings.defaultTagMode.stationaryUpdateRateMs,
    ),
    scanDurationSeconds: String(settings.scanDurationMs / 1_000),
    autoConnect: settings.autoConnect,
    positionLogRetentionDays: String(settings.positionLogRetentionDays),
    positionLogMaxSamples: String(settings.positionLogMaxSamples),
    locationEngineEnabled: settings.defaultTagMode.locationEngineEnabled,
    lowPowerModeEnabled: settings.defaultTagMode.lowPowerModeEnabled,
    stationaryDetectionEnabled:
      settings.defaultTagMode.stationaryDetectionEnabled,
    locationDataMode: settings.defaultTagMode.locationDataMode,
  };
}

export function parseNetworkSettingsForm(
  form: NetworkSettingsFormState,
): NetworkSettingsFormResult {
  const numeric = {
    minX: parseFinite(form.minXMeters),
    maxX: parseFinite(form.maxXMeters),
    minY: parseFinite(form.minYMeters),
    maxY: parseFinite(form.maxYMeters),
    minZ: parseFinite(form.minZMeters),
    maxZ: parseFinite(form.maxZMeters),
    anchorHeight: parseFinite(form.defaultAnchorHeightMeters),
    staleSeconds: parseFinite(form.staleDeviceTimeoutSeconds),
    movingRate: parseFinite(form.movingUpdateRateMs),
    stationaryRate: parseFinite(form.stationaryUpdateRateMs),
    scanSeconds: parseFinite(form.scanDurationSeconds),
    retentionDays: parseFinite(form.positionLogRetentionDays),
    maxSamples: parseFinite(form.positionLogMaxSamples),
  };
  if (Object.values(numeric).some((value) => value === undefined)) {
    return { error: "All network setting numbers must be finite." };
  }
  const values = numeric as Record<keyof typeof numeric, number>;
  if (
    values.minX >= values.maxX ||
    values.minY >= values.maxY ||
    values.minZ >= values.maxZ
  ) {
    return { error: "Each coordinate minimum must be less than its maximum." };
  }
  if (
    !Number.isFinite(values.staleSeconds * 1_000) ||
    !Number.isFinite(values.scanSeconds * 1_000)
  ) {
    return {
      error: "Converted timeout and scan duration values must be finite.",
    };
  }
  if (values.anchorHeight < values.minZ || values.anchorHeight > values.maxZ) {
    return { error: "Default anchor height must be inside the Z bounds." };
  }
  if (
    values.staleSeconds <= 0 ||
    values.movingRate <= 0 ||
    values.stationaryRate <= 0 ||
    values.scanSeconds <= 0 ||
    values.retentionDays <= 0 ||
    values.maxSamples <= 0
  ) {
    return {
      error: "Timeouts, rates, retention, and sample limits must be positive.",
    };
  }
  if (
    !Number.isInteger(values.retentionDays) ||
    !Number.isInteger(values.maxSamples)
  ) {
    return {
      error: "Retention days and maximum samples must be whole numbers.",
    };
  }

  return {
    settings: {
      coordinateBounds: {
        minXMeters: values.minX,
        maxXMeters: values.maxX,
        minYMeters: values.minY,
        maxYMeters: values.maxY,
        minZMeters: values.minZ,
        maxZMeters: values.maxZ,
      },
      defaultAnchorHeightMeters: values.anchorHeight,
      staleDeviceTimeoutMs: values.staleSeconds * 1_000,
      defaultTagMode: {
        locationEngineEnabled: form.locationEngineEnabled,
        lowPowerModeEnabled: form.lowPowerModeEnabled,
        stationaryDetectionEnabled: form.stationaryDetectionEnabled,
        locationDataMode: form.locationDataMode,
        movingUpdateRateMs: values.movingRate,
        stationaryUpdateRateMs: values.stationaryRate,
      },
      scanDurationMs: values.scanSeconds * 1_000,
      autoConnect: form.autoConnect,
      positionLogRetentionDays: values.retentionDays,
      positionLogMaxSamples: values.maxSamples,
    },
  };
}

function parseFinite(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
