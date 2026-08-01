import {
  deviceFromDiscovery,
  normalizeTransportDeviceId,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
} from "@eight2five/mobile/pans-manager";

import { createLocalId } from "./mobile-pans-model";
import type { MobilePansRuntime } from "./mobile-pans-runtime";

export async function persistSelectedTagAndNearbyAnchors(
  runtime: MobilePansRuntime,
  discovery: DiscoveredDeviceSnapshot,
  discoveries: readonly DiscoveredDeviceSnapshot[],
  now: number,
): Promise<ManagedDevice> {
  const devices = await runtime.repository.listDevices();
  const existingTag = findSavedDevice(devices, discovery);
  let tag = await runtime.repository.saveDevice({
    ...deviceFromDiscovery(discovery, existingTag, {
      id: existingTag?.id ?? createLocalId("tag"),
      now,
    }),
    role: "tag",
  });
  const anchors: ManagedDevice[] = [];
  for (const nearbyAnchor of discoveries.filter(isCurrentCompatibleAnchor)) {
    const existingAnchor = findSavedDevice(devices, nearbyAnchor);
    anchors.push(
      await runtime.repository.saveDevice({
        ...deviceFromDiscovery(nearbyAnchor, existingAnchor, {
          id: existingAnchor?.id ?? createLocalId("anchor"),
          now,
        }),
        role: "anchor",
      }),
    );
  }

  // Selection is an explicit refresh boundary. Read each discovered device
  // once so PAN-based association is verified rather than inferred by proximity.
  await runtime.discovery.stop();
  tag = await inspectAndReload(runtime, tag);
  for (let index = 0; index < anchors.length; index += 1) {
    anchors[index] = await inspectAndReload(runtime, anchors[index]);
  }

  const panId = tag.lastKnownConfig?.panId;
  if (panId === undefined) return tag;
  const matchingNetworks = (await runtime.repository.listNetworks()).filter(
    (network) => network.panId === panId,
  );
  if (matchingNetworks.length !== 1) return tag;
  const network = matchingNetworks[0];
  tag = await runtime.repository.associateDevice({
    networkId: network.id,
    deviceId: tag.id,
    associatedAt: now,
  });
  for (const anchor of anchors) {
    if (anchor.lastKnownConfig?.panId !== panId) continue;
    await runtime.repository.associateDevice({
      networkId: network.id,
      deviceId: anchor.id,
      associatedAt: now,
    });
  }
  return tag;
}

export function sortedCachedAnchors(
  devices: readonly ManagedDevice[],
): readonly ManagedDevice[] {
  return devices
    .filter(
      (device) =>
        device.role === "anchor" || device.lastKnownConfig?.role === "anchor",
    )
    .sort((left, right) =>
      (left.nodeIdHex ?? left.label ?? left.id).localeCompare(
        right.nodeIdHex ?? right.label ?? right.id,
      ),
    );
}

function findSavedDevice(
  devices: readonly ManagedDevice[],
  discovery: DiscoveredDeviceSnapshot,
): ManagedDevice | undefined {
  const transportId = normalizeTransportDeviceId(discovery.transportDeviceId);
  return devices.find(
    (device) =>
      normalizeTransportDeviceId(device.transportDeviceId) === transportId ||
      Boolean(
        discovery.macAddress && device.macAddress === discovery.macAddress,
      ),
  );
}

function isCurrentCompatibleAnchor(
  discovery: DiscoveredDeviceSnapshot,
): boolean {
  return (
    !discovery.stale &&
    discovery.compatibility === "compatible" &&
    discovery.presence?.role === "anchor"
  );
}

async function inspectAndReload(
  runtime: MobilePansRuntime,
  device: ManagedDevice,
): Promise<ManagedDevice> {
  try {
    await runtime.configuration.inspectAndCache?.(device.id);
    return (await runtime.repository.getDevice(device.id)) ?? device;
  } catch {
    // Keep the discovery record pending; selectors exclude it until a later
    // explicit refresh verifies network data.
    return device;
  }
}
