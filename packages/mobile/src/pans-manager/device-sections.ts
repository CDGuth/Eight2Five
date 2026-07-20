import {
  getCanonicalDeviceIdentifier,
  getDeviceDisplayName,
  getNetworkDisplayName,
} from "./display";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagedNetwork,
} from "./types";

export type DeviceNetworkStatus =
  | "unassigned"
  | "assigned-unverified"
  | "assigned-matching"
  | "assigned-pan-mismatch"
  | "unavailable";

/** @deprecated Use DeviceNetworkStatus. */
export type NetworkDeviceStatus = DeviceNetworkStatus;

/** A saved device or discovery-only device prepared for manager presentation. */
export interface DisplayDevice {
  key: string;
  id: string;
  transportDeviceId: string;
  canonicalIdentifier: string;
  displayName: string;
  status: DeviceNetworkStatus;
  available: boolean;
  networkId?: string;
  rssi?: number;
  savedDevice?: ManagedDevice;
  discovery?: DiscoveredDeviceSnapshot;
}

export interface NetworkDeviceSection {
  key: string;
  type: "unassigned" | "network";
  network?: ManagedNetwork;
  devices: DisplayDevice[];
}

/**
 * Joins app-side records with current transport discoveries. Advertisements
 * provide availability and RSSI only; PAN status always comes from cached
 * hardware configuration.
 */
export function selectNetworkDeviceSections(
  networks: readonly ManagedNetwork[],
  devices: readonly ManagedDevice[],
  discoveries: readonly DiscoveredDeviceSnapshot[],
): NetworkDeviceSection[] {
  const currentDiscoveries = selectDiscoveriesByTransportId(discoveries);
  const savedTransportIds = new Set(
    devices.map((device) => device.transportDeviceId),
  );
  const profilesById = new Map(
    networks.map((network) => [network.id, network]),
  );
  const unassigned: NetworkDeviceSection = {
    key: "unassigned",
    type: "unassigned",
    devices: [],
  };
  const profileSections = [...networks]
    .sort(compareNetworks)
    .map<NetworkDeviceSection>((network) => ({
      key: `network:${network.id}`,
      type: "network",
      network,
      devices: [],
    }));
  const sectionsByNetworkId = new Map(
    profileSections.map((section) => [section.network!.id, section]),
  );

  for (const device of devices) {
    const discovery = currentDiscoveries.get(device.transportDeviceId);
    const profile = device.networkId
      ? profilesById.get(device.networkId)
      : undefined;
    const display = displaySavedDevice(device, profile, discovery);
    (profile ? sectionsByNetworkId.get(profile.id)! : unassigned).devices.push(
      display,
    );
  }

  for (const discovery of currentDiscoveries.values()) {
    if (!savedTransportIds.has(discovery.transportDeviceId)) {
      unassigned.devices.push(displayDiscoveryOnlyDevice(discovery));
    }
  }
  discoveries.forEach((discovery, index) => {
    if (!discovery.transportDeviceId) {
      unassigned.devices.push(displayDiscoveryOnlyDevice(discovery, index));
    }
  });

  for (const section of [unassigned, ...profileSections]) {
    section.devices.sort(compareDisplayDevices);
  }
  return [unassigned, ...profileSections];
}

function displaySavedDevice(
  device: ManagedDevice,
  profile: ManagedNetwork | undefined,
  discovery: DiscoveredDeviceSnapshot | undefined,
): DisplayDevice {
  const available = discovery !== undefined && discovery.stale !== true;
  return {
    key: `device:${device.id}`,
    id: device.id,
    transportDeviceId: device.transportDeviceId,
    canonicalIdentifier: getCanonicalDeviceIdentifier(device),
    displayName: getDeviceDisplayName(device),
    status: statusForSavedDevice(device, profile, available),
    available,
    ...(device.networkId ? { networkId: device.networkId } : {}),
    ...(available ? { rssi: discovery.rssi } : {}),
    savedDevice: device,
    ...(discovery ? { discovery } : {}),
  };
}

function displayDiscoveryOnlyDevice(
  discovery: DiscoveredDeviceSnapshot,
  index?: number,
): DisplayDevice {
  const fallbackId =
    discovery.transportDeviceId ||
    discovery.macAddress ||
    `discovery-${discovery.lastSeenAt}-${index ?? 0}`;
  const identity = {
    id: fallbackId,
    transportDeviceId: discovery.transportDeviceId,
    nodeIdHex: undefined,
    nickname: undefined,
  };
  const available = discovery.stale !== true;
  return {
    key: `discovery:${fallbackId}${index === undefined ? "" : `:${index}`}`,
    id: fallbackId,
    transportDeviceId: discovery.transportDeviceId,
    canonicalIdentifier: getCanonicalDeviceIdentifier(identity),
    displayName: getDeviceDisplayName(identity),
    status: available ? "unassigned" : "unavailable",
    available,
    ...(available ? { rssi: discovery.rssi } : {}),
    discovery,
  };
}

function statusForSavedDevice(
  device: ManagedDevice,
  profile: ManagedNetwork | undefined,
  available: boolean,
): DeviceNetworkStatus {
  if (!available) return "unavailable";
  if (!profile) return "unassigned";
  const cachedPanId = device.lastKnownConfig?.panId;
  if (cachedPanId === undefined) return "assigned-unverified";
  return cachedPanId === profile.panId
    ? "assigned-matching"
    : "assigned-pan-mismatch";
}

function selectDiscoveriesByTransportId(
  discoveries: readonly DiscoveredDeviceSnapshot[],
): Map<string, DiscoveredDeviceSnapshot> {
  const selected = new Map<string, DiscoveredDeviceSnapshot>();
  for (const discovery of discoveries) {
    if (!discovery.transportDeviceId) continue;
    const previous = selected.get(discovery.transportDeviceId);
    if (!previous || compareDiscoveryFreshness(discovery, previous) < 0) {
      selected.set(discovery.transportDeviceId, discovery);
    }
  }
  return selected;
}

function compareDiscoveryFreshness(
  left: DiscoveredDeviceSnapshot,
  right: DiscoveredDeviceSnapshot,
): number {
  return (
    Number(left.stale === true) - Number(right.stale === true) ||
    right.lastSeenAt - left.lastSeenAt ||
    right.rssi - left.rssi
  );
}

function compareNetworks(left: ManagedNetwork, right: ManagedNetwork): number {
  return (
    getNetworkDisplayName(left).localeCompare(getNetworkDisplayName(right)) ||
    left.panId - right.panId ||
    left.id.localeCompare(right.id)
  );
}

function compareDisplayDevices(
  left: DisplayDevice,
  right: DisplayDevice,
): number {
  return (
    left.displayName.localeCompare(right.displayName) ||
    left.canonicalIdentifier.localeCompare(right.canonicalIdentifier) ||
    left.transportDeviceId.localeCompare(right.transportDeviceId) ||
    left.key.localeCompare(right.key)
  );
}
