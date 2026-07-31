export type MapUnits = "metric" | "imperial";
export type MapAreaMode = "infinite" | "bounded";

export const METERS_PER_FOOT = 0.3048;

export function mapUnitAbbreviation(units: MapUnits): "m" | "ft" {
  return units === "imperial" ? "ft" : "m";
}

export function metersToMapUnits(valueMeters: number, units: MapUnits): number {
  return units === "imperial" ? valueMeters / METERS_PER_FOOT : valueMeters;
}

export function mapUnitsToMeters(value: number, units: MapUnits): number {
  return units === "imperial" ? value * METERS_PER_FOOT : value;
}

export function formatMapDistance(
  valueMeters: number,
  units: MapUnits,
  maximumFractionDigits = 3,
): string {
  return `${formatMapNumber(
    metersToMapUnits(valueMeters, units),
    maximumFractionDigits,
  )} ${mapUnitAbbreviation(units)}`;
}

export function formatMapCoordinate(
  valueMeters: number,
  units: MapUnits,
  maximumFractionDigits = 3,
): string {
  return formatMapNumber(
    metersToMapUnits(valueMeters, units),
    maximumFractionDigits,
  );
}

export function formatMapNumber(
  value: number,
  maximumFractionDigits = 3,
): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(maximumFractionDigits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function convertMapInputText(
  value: string,
  fromUnits: MapUnits,
  toUnits: MapUnits,
  maximumFractionDigits = 6,
): string {
  const trimmed = value.trim();
  if (!trimmed || fromUnits === toUnits) return value;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return value;
  return formatMapNumber(
    metersToMapUnits(mapUnitsToMeters(parsed, fromUnits), toUnits),
    maximumFractionDigits,
  );
}
