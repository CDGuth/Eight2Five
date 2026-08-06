import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
} from "@eight2five/mobile/pans-manager";

export type AdvertisedAnchorRole = "anchor" | "tag" | "unknown";

export interface NetworkAnchorDiscoveryRow {
  readonly discovery: DiscoveredDeviceSnapshot;
  readonly cachedAnchor?: ManagedDevice;
  readonly advertisedRole: AdvertisedAnchorRole;
  readonly requiresRoleChangeConfirmation: boolean;
}

export function isManagedAnchor(device: ManagedDevice): boolean {
  return device.role === "anchor" || device.lastKnownConfig?.role === "anchor";
}

export function selectAssociatedCachedAnchors(
  networkId: string,
  knownAnchors: readonly ManagedDevice[],
): readonly ManagedDevice[] {
  return knownAnchors.filter(
    (anchor) => anchor.networkId === networkId && isManagedAnchor(anchor),
  );
}

/**
 * Discovery is intentionally the first source for this list. A cached device
 * is attached to a discovery row when the transport identity matches, but a
 * compatible advertisement with no cache entry is retained as well.
 */
export function selectNetworkAnchorDiscoveries(
  discoveries: readonly DiscoveredDeviceSnapshot[],
  knownAnchors: readonly ManagedDevice[],
  cutoff: number,
): readonly NetworkAnchorDiscoveryRow[] {
  return discoveries
    .filter(
      (discovery) =>
        !discovery.stale &&
        discovery.compatibility === "compatible" &&
        discovery.rssi >= cutoff,
    )
    .sort((left, right) => {
      const rssiDifference = right.rssi - left.rssi;
      return rssiDifference !== 0
        ? rssiDifference
        : left.transportDeviceId.localeCompare(right.transportDeviceId);
    })
    .map((discovery) => {
      const cachedAnchor = knownAnchors.find(
        (anchor) =>
          normalizeTransportKey(anchor.transportDeviceId) ===
            normalizeTransportKey(discovery.transportDeviceId) &&
          isManagedAnchor(anchor),
      );
      const advertisedRole = advertisedRoleForDiscovery(discovery);
      return {
        discovery,
        ...(cachedAnchor ? { cachedAnchor } : {}),
        advertisedRole,
        requiresRoleChangeConfirmation: advertisedRole !== "anchor",
      };
    });
}

export function advertisedRoleForDiscovery(
  discovery: DiscoveredDeviceSnapshot,
): AdvertisedAnchorRole {
  const role = discovery.presence?.role;
  return role === "anchor" || role === "tag" ? role : "unknown";
}

export function anchorInitiatorLabel(
  anchor: ManagedDevice | undefined,
): "Yes" | "No" | "Unknown" {
  const config =
    anchor?.lastKnownConfig?.role === "anchor"
      ? anchor.lastKnownConfig
      : undefined;
  return config ? (config.initiatorEnabled ? "Yes" : "No") : "Unknown";
}

/** Preserve the store's wording; an absent warning must not imply verification. */
export function commissioningWarningText(
  warning: string | undefined,
): string | undefined {
  return warning?.trim() || undefined;
}

function normalizeTransportKey(deviceId: string): string {
  const trimmed = deviceId.trim();
  const compact = trimmed.replace(/[:-]/g, "");
  return /^[0-9a-f]+$/i.test(compact)
    ? compact.toUpperCase()
    : trimmed.toLocaleLowerCase();
}
