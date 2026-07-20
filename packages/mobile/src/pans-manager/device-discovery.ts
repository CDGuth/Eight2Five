import type { DiscoveredDeviceSnapshot, ManagedDevice } from "./types";

export interface DeviceFromDiscoveryOptions {
  /** Required when no existing saved device is supplied. */
  id?: string;
  now?: number;
}

/**
 * Merges transport discovery data into an app-side device record. Discovery
 * names are advertisements, not hardware PANS labels, and are never promoted
 * to `label`.
 */
export function deviceFromDiscovery(
  discovery: DiscoveredDeviceSnapshot,
  existing?: ManagedDevice,
  options: DeviceFromDiscoveryOptions = {},
): ManagedDevice {
  const id = existing?.id ?? options.id;
  if (!id) {
    throw new Error("A local device ID is required for a new discovery.");
  }
  const discoveredLastSeenAt = Number.isFinite(discovery.lastSeenAt)
    ? discovery.lastSeenAt
    : undefined;
  const observedLater =
    discoveredLastSeenAt !== undefined &&
    (existing?.lastSeenAt === undefined ||
      discoveredLastSeenAt >= existing.lastSeenAt);
  const discoveredMac = concreteText(discovery.macAddress);
  const discoveredRole = discovery.presence?.role;
  const now = options.now ?? Date.now();

  return {
    ...(existing ?? {}),
    id,
    transportDeviceId:
      discovery.transportDeviceId || existing?.transportDeviceId || "",
    ...(observedLater && discoveredMac
      ? { macAddress: discoveredMac }
      : existing?.macAddress
        ? { macAddress: existing.macAddress }
        : {}),
    ...(observedLater && discoveredRole
      ? { role: discoveredRole }
      : existing?.role
        ? { role: existing.role }
        : {}),
    ...(discoveredLastSeenAt !== undefined
      ? {
          lastSeenAt: Math.max(
            existing?.lastSeenAt ?? discoveredLastSeenAt,
            discoveredLastSeenAt,
          ),
        }
      : existing?.lastSeenAt !== undefined
        ? { lastSeenAt: existing.lastSeenAt }
        : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
  };
}

function concreteText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
