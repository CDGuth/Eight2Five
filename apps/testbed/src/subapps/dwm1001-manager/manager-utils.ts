import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagedDeviceConfig,
} from "@eight2five/mobile/pans-manager";

export function createManagerId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid}`;
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function deviceFromDiscovery(
  discovery: DiscoveredDeviceSnapshot,
  existing?: ManagedDevice,
): ManagedDevice {
  const now = Date.now();
  return {
    id: existing?.id ?? createManagerId("device"),
    transportDeviceId: discovery.transportDeviceId,
    ...(discovery.macAddress ? { macAddress: discovery.macAddress } : {}),
    ...(existing?.networkId ? { networkId: existing.networkId } : {}),
    ...(existing?.nickname ? { nickname: existing.nickname } : {}),
    ...(existing?.label ? { label: existing.label } : {}),
    ...(discovery.presence?.role ? { role: discovery.presence.role } : {}),
    ...(existing?.lastKnownConfig
      ? { lastKnownConfig: existing.lastKnownConfig }
      : {}),
    lastSeenAt: discovery.lastSeenAt,
    ...(existing?.notes ? { notes: existing.notes } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function defaultConfigForDevice(
  device: ManagedDevice,
): ManagedDeviceConfig {
  if (device.lastKnownConfig) return device.lastKnownConfig;
  if (device.role === "anchor") {
    return {
      role: "anchor",
      ...(device.label ? { label: device.label } : {}),
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
    };
  }
  return {
    role: "tag",
    ...(device.label ? { label: device.label } : {}),
    uwbMode: "active",
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    locationEngineEnabled: true,
    lowPowerModeEnabled: false,
    stationaryDetectionEnabled: true,
    locationDataMode: 0,
  };
}

export function displayError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatRelativeTime(
  timestamp?: number,
  now = Date.now(),
): string {
  if (!timestamp) return "Never";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function bytesToHex(bytes?: number[]): string {
  if (!bytes?.length) return "Unavailable";
  return bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ");
}
