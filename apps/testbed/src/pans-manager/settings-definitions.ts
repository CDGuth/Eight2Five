import {
  formatPanId,
  mapUnitsToMeters,
  parsePanId,
  type MapAreaMode,
  type MapUnits,
} from "@eight2five/mobile/pans-manager";

import type { SelectChoice } from "./components/manager-ui";

export const MAP_UNIT_CHOICES = [
  { label: "Metric (meters)", value: "metric" },
  { label: "Imperial (feet)", value: "imperial" },
] as const satisfies readonly SelectChoice<MapUnits>[];

export const MAP_AREA_MODE_CHOICES = [
  { label: "Infinite canvas", value: "infinite" },
  { label: "Bounded area", value: "bounded" },
] as const satisfies readonly SelectChoice<MapAreaMode>[];

export type LocationDataModeChoice = "0" | "1" | "2";
export const LOCATION_DATA_MODE_CHOICES = [
  { label: "Position only (0)", value: "0" },
  { label: "Distances only (1)", value: "1" },
  { label: "Position and distances (2)", value: "2" },
] as const satisfies readonly SelectChoice<LocationDataModeChoice>[];

export function formatLocationDataMode(
  value: 0 | 1 | 2,
): LocationDataModeChoice {
  return String(value) as LocationDataModeChoice;
}

export function parseLocationDataMode(
  value: LocationDataModeChoice,
): 0 | 1 | 2 {
  return Number(value) as 0 | 1 | 2;
}

export type ExportFormat = "csv" | "json";
export const EXPORT_FORMAT_CHOICES = [
  { label: "JSON", value: "json" },
  { label: "CSV", value: "csv" },
] as const satisfies readonly SelectChoice<ExportFormat>[];

export { formatPanId, parsePanId };

export function formatPanInput(panId: number): string {
  return formatPanId(panId);
}

export function parsePanInput(value: string): number | undefined {
  try {
    return parsePanId(value);
  } catch {
    return undefined;
  }
}

export const ANCHOR_POSITION_QUALITY = {
  default: 100,
  minimum: 1,
  maximum: 100,
} as const;

export function parseAnchorCoordinate(
  value: string | undefined,
  units: MapUnits = "metric",
): number | undefined {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? mapUnitsToMeters(parsed, units) : undefined;
}

export function anchorCoordinateError(
  value: string | undefined,
  requiredMessage = "Required when writing a position.",
): string | undefined {
  if (!(value?.trim() ?? "")) return requiredMessage;
  return parseAnchorCoordinate(value) === undefined
    ? "Enter a finite coordinate."
    : undefined;
}

export function parseAnchorQuality(
  value: string | undefined,
): number | undefined {
  const text = value?.trim() ?? "";
  if (!text) return ANCHOR_POSITION_QUALITY.default;
  const parsed = Number(text);
  return Number.isInteger(parsed) &&
    parsed >= ANCHOR_POSITION_QUALITY.minimum &&
    parsed <= ANCHOR_POSITION_QUALITY.maximum
    ? parsed
    : undefined;
}

export function anchorQualityError(value: string | undefined) {
  return parseAnchorQuality(value) === undefined
    ? "Enter an integer from 1 to 100, or leave blank for 100."
    : undefined;
}
