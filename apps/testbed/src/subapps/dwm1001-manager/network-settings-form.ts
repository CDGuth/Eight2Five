import type { ManagedNetworkSettings } from "@eight2five/mobile/pans-manager/types";
import {
  convertMapInputText,
  formatMapCoordinate,
  mapUnitsToMeters,
  type MapUnits,
} from "@eight2five/mobile/pans-manager/map-units";

export interface NetworkSettingsFormState {
  mapUnits: ManagedNetworkSettings["mapUnits"];
  mapAreaMode: ManagedNetworkSettings["mapAreaMode"];
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
    mapUnits: settings.mapUnits,
    mapAreaMode: settings.mapAreaMode,
    minXMeters: formatMapCoordinate(
      settings.coordinateBounds.minXMeters,
      settings.mapUnits,
      6,
    ),
    maxXMeters: formatMapCoordinate(
      settings.coordinateBounds.maxXMeters,
      settings.mapUnits,
      6,
    ),
    minYMeters: formatMapCoordinate(
      settings.coordinateBounds.minYMeters,
      settings.mapUnits,
      6,
    ),
    maxYMeters: formatMapCoordinate(
      settings.coordinateBounds.maxYMeters,
      settings.mapUnits,
      6,
    ),
    minZMeters: formatMapCoordinate(
      settings.coordinateBounds.minZMeters,
      settings.mapUnits,
      6,
    ),
    maxZMeters: formatMapCoordinate(
      settings.coordinateBounds.maxZMeters,
      settings.mapUnits,
      6,
    ),
    defaultAnchorHeightMeters: formatMapCoordinate(
      settings.defaultAnchorHeightMeters,
      settings.mapUnits,
      6,
    ),
    staleDeviceTimeoutSeconds: String(settings.staleDeviceTimeoutMs / 1_000),
    movingUpdateRateMs: String(settings.defaultTagMode.movingUpdateRateMs),
    stationaryUpdateRateMs: String(
      settings.defaultTagMode.stationaryUpdateRateMs,
    ),
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
    minX: parseMapDistance(form.minXMeters, form.mapUnits),
    maxX: parseMapDistance(form.maxXMeters, form.mapUnits),
    minY: parseMapDistance(form.minYMeters, form.mapUnits),
    maxY: parseMapDistance(form.maxYMeters, form.mapUnits),
    minZ: parseMapDistance(form.minZMeters, form.mapUnits),
    maxZ: parseMapDistance(form.maxZMeters, form.mapUnits),
    anchorHeight: parseMapDistance(
      form.defaultAnchorHeightMeters,
      form.mapUnits,
    ),
    staleSeconds: parseFinite(form.staleDeviceTimeoutSeconds),
    movingRate: parseFinite(form.movingUpdateRateMs),
    stationaryRate: parseFinite(form.stationaryUpdateRateMs),
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
  if (!Number.isFinite(values.staleSeconds * 1_000)) {
    return {
      error: "Converted timeout value must be finite.",
    };
  }
  if (values.anchorHeight < values.minZ || values.anchorHeight > values.maxZ) {
    return { error: "Default anchor height must be inside the Z bounds." };
  }
  if (
    values.staleSeconds <= 0 ||
    values.movingRate <= 0 ||
    values.stationaryRate <= 0 ||
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
      mapUnits: form.mapUnits,
      mapAreaMode: form.mapAreaMode,
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
      autoConnect: form.autoConnect,
      positionLogRetentionDays: values.retentionDays,
      positionLogMaxSamples: values.maxSamples,
    },
  };
}

export function convertNetworkSettingsFormUnits(
  form: NetworkSettingsFormState,
  mapUnits: MapUnits,
): NetworkSettingsFormState {
  if (form.mapUnits === mapUnits) return form;
  const convert = (value: string) =>
    convertMapInputText(value, form.mapUnits, mapUnits, 12);
  return {
    ...form,
    mapUnits,
    minXMeters: convert(form.minXMeters),
    maxXMeters: convert(form.maxXMeters),
    minYMeters: convert(form.minYMeters),
    maxYMeters: convert(form.maxYMeters),
    minZMeters: convert(form.minZMeters),
    maxZMeters: convert(form.maxZMeters),
    defaultAnchorHeightMeters: convert(form.defaultAnchorHeightMeters),
  };
}

function parseMapDistance(value: string, units: MapUnits): number | undefined {
  const parsed = parseFinite(value);
  return parsed === undefined
    ? undefined
    : Math.round(mapUnitsToMeters(parsed, units) * 1_000_000_000) /
        1_000_000_000;
}

function parseFinite(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
