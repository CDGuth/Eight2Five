import type { PansPosition } from "expo-pans-ble-api";
import { ManagerError } from "./errors";
import type { ManagedDeviceConfig } from "./types";

const MAX_INT32_METERS = 2_147_483_647 / 1_000;

export function parsePanId(value: string | number): number {
  if (typeof value === "number") {
    assertPanId(value);
    return value;
  }
  const text = value.trim();
  const parsed = /^0x[0-9a-f]+$/i.test(text)
    ? Number.parseInt(text.slice(2), 16)
    : /[a-f]/i.test(text) && /^[0-9a-f]+$/i.test(text)
      ? Number.parseInt(text, 16)
      : /^[0-9]+$/.test(text)
        ? Number.parseInt(text, 10)
        : Number.NaN;
  assertPanId(parsed);
  return parsed;
}

export function assertPanId(panId: number): void {
  if (!Number.isInteger(panId) || panId < 0 || panId > 0xffff) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "PAN ID must be an integer from 0 to 65535.",
    );
  }
}

export function formatPanId(panId: number): string {
  assertPanId(panId);
  return `0x${panId.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function isUniqueName(
  name: string,
  existingNames: Iterable<string>,
  currentName?: string,
): boolean {
  const normalized = normalizeName(name);
  const ignored =
    currentName === undefined ? undefined : normalizeName(currentName);
  return !Array.from(existingNames).some((candidate) => {
    const item = normalizeName(candidate);
    return item === normalized && item !== ignored;
  });
}

export function assertUniqueName(
  name: string,
  existingNames: Iterable<string>,
  currentName?: string,
): void {
  if (!name.trim() || !isUniqueName(name, existingNames, currentName)) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "A network with this name already exists.",
    );
  }
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function assertValidLabel(label: string): void {
  if (utf8ByteLength(label) > 16) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Device label must be at most 16 UTF-8 bytes.",
    );
  }
}

export function assertValidPosition(position: PansPosition): void {
  for (const [name, value] of Object.entries({
    xMeters: position.xMeters,
    yMeters: position.yMeters,
    zMeters: position.zMeters,
  })) {
    if (!Number.isFinite(value) || Math.abs(value) > MAX_INT32_METERS) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        `${name} must be finite and fit the persisted-position range.`,
      );
    }
  }
  if (
    !Number.isInteger(position.quality) ||
    position.quality < 1 ||
    position.quality > 100
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Position quality must be an integer from 1 to 100.",
    );
  }
}

export function assertValidUpdateRate(rateMs: number): void {
  if (!Number.isSafeInteger(rateMs) || rateMs <= 0 || rateMs > 0xffffffff) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Update rate must be a positive 32-bit millisecond integer.",
    );
  }
}

export function normalizeDeviceConfig(
  config: ManagedDeviceConfig,
): ManagedDeviceConfig {
  if (config.role !== "anchor" && config.role !== "tag") {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Device role must be anchor or tag.",
    );
  }
  if (
    !["off", "passive", "active"].includes(config.uwbMode) ||
    (config.selectedFirmware !== undefined &&
      config.selectedFirmware !== 1 &&
      config.selectedFirmware !== 2) ||
    typeof config.ledEnabled !== "boolean" ||
    typeof config.firmwareUpdateEnabled !== "boolean"
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "UWB mode, LED state, and firmware-update state are required.",
    );
  }
  if (config.label !== undefined) assertValidLabel(config.label);
  if (config.panId !== undefined) assertPanId(config.panId);
  if (config.role === "anchor") {
    if (
      "locationDataMode" in config ||
      "movingUpdateRateMs" in config ||
      "stationaryUpdateRateMs" in config ||
      "locationEngineEnabled" in config ||
      "lowPowerModeEnabled" in config ||
      "stationaryDetectionEnabled" in config
    ) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Tag-only fields cannot be used for an anchor.",
      );
    }
    if (typeof config.initiatorEnabled !== "boolean") {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Anchor initiator state is required.",
      );
    }
    if (config.position) assertValidPosition(config.position);
  } else {
    if ("position" in config || "initiatorEnabled" in config) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Anchor-only fields cannot be used for a tag.",
      );
    }
    if (config.movingUpdateRateMs !== undefined)
      assertValidUpdateRate(config.movingUpdateRateMs);
    if (config.stationaryUpdateRateMs !== undefined)
      assertValidUpdateRate(config.stationaryUpdateRateMs);
    if (
      typeof config.locationEngineEnabled !== "boolean" ||
      typeof config.lowPowerModeEnabled !== "boolean" ||
      typeof config.stationaryDetectionEnabled !== "boolean" ||
      config.locationDataMode === undefined ||
      ![0, 1, 2].includes(config.locationDataMode)
    ) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Tag location mode and role flags are required.",
      );
    }
  }
  return stableObject(config) as ManagedDeviceConfig;
}

export interface ConfigDifference {
  field: string;
  current: unknown;
  requested: unknown;
}

export function diffDeviceConfig(
  current: Partial<ManagedDeviceConfig>,
  requested: ManagedDeviceConfig,
): ConfigDifference[] {
  const normalized = normalizeDeviceConfig(requested) as unknown as Record<
    string,
    unknown
  >;
  const before = current as Record<string, unknown>;
  return Object.keys(normalized)
    .sort()
    .filter((key) => !deepEqual(before[key], normalized[key]))
    .map((field) => ({
      field,
      current: before[field],
      requested: normalized[field],
    }));
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableObject(item)]),
    );
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(stableObject(left)) === JSON.stringify(stableObject(right))
  );
}
