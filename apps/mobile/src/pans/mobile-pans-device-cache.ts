import {
  deviceFromDiscovery,
  normalizeTransportDeviceId,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
} from "@eight2five/mobile/pans-manager";

import { createLocalId } from "./mobile-pans-model";
import type { MobilePansRuntime } from "./mobile-pans-runtime";

/** Persist only the explicitly selected performer tag. */
export async function persistSelectedTag(
  runtime: MobilePansRuntime,
  discovery: DiscoveredDeviceSnapshot,
  now: number,
): Promise<ManagedDevice> {
  const devices = await runtime.repository.listDevices();
  const existing = findSavedDevice(devices, discovery);
  return await runtime.repository.saveDevice({
    ...deviceFromDiscovery(discovery, existing, {
      id: existing?.id ?? createLocalId("tag"),
      now,
    }),
    role: "tag",
  });
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
