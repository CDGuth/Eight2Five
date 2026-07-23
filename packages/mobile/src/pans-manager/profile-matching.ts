import type { ManagedDevice, ManagedNetwork } from "./types";

export type CachedProfileMatchStatus =
  | "unverified"
  | "unassigned"
  | "matched"
  | "conflict";

export interface CachedProfileMatch {
  status: CachedProfileMatchStatus;
  panId?: number;
  networkId?: string;
  matchingNetworkIds: string[];
}

/** Resolves app profile membership only from the last hardware-verified PAN ID. */
export function resolveCachedProfileMatch(
  networks: readonly ManagedNetwork[],
  panId: number | undefined,
): CachedProfileMatch {
  if (panId === undefined) {
    return { status: "unverified", matchingNetworkIds: [] };
  }
  const matchingNetworkIds = networks
    .filter((network) => network.panId === panId)
    .map((network) => network.id)
    .sort();
  if (matchingNetworkIds.length === 0) {
    return { status: "unassigned", panId, matchingNetworkIds };
  }
  if (matchingNetworkIds.length > 1) {
    return { status: "conflict", panId, matchingNetworkIds };
  }
  return {
    status: "matched",
    panId,
    networkId: matchingNetworkIds[0],
    matchingNetworkIds,
  };
}

export function reconcileDeviceCachedProfileMatch(
  device: ManagedDevice,
  networks: readonly ManagedNetwork[],
  updatedAt: number,
): ManagedDevice {
  const match = resolveCachedProfileMatch(
    networks,
    device.lastKnownConfig?.panId,
  );
  if (device.networkId === match.networkId) return device;
  const next = { ...device, updatedAt };
  if (match.networkId) next.networkId = match.networkId;
  else delete next.networkId;
  return next;
}
