import type { ManagedDevice, ManagedNetwork } from "./types";
import { formatPanId } from "./validation";

type DeviceDisplayIdentity = Pick<
  ManagedDevice,
  "id" | "transportDeviceId" | "nodeIdHex" | "label" | "lastKnownConfig"
>;

/** Returns the best stable hardware/transport/local identifier for a device. */
export function getCanonicalDeviceIdentifier(
  device: DeviceDisplayIdentity,
): string {
  const nodeIdHex = device.nodeIdHex?.trim();
  const transportDeviceId = device.transportDeviceId.trim();
  return nodeIdHex || transportDeviceId || device.id.trim();
}

/** Returns a hardware-derived display name with a stable identifier fallback. */
export function getDeviceDisplayName(device: DeviceDisplayIdentity): string {
  return (
    device.lastKnownConfig?.label?.trim() ||
    device.label?.trim() ||
    `Device ${getCanonicalDeviceIdentifier(device)}`
  );
}

/** Returns a computed profile name without mutating or persisting a default. */
export function getNetworkDisplayName(network: ManagedNetwork): string {
  return network.name.trim() || `Network ${formatPanId(network.panId)}`;
}
