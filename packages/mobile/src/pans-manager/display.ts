import type { ManagedDevice, ManagedNetwork } from "./types";
import { formatPanId } from "./validation";

type DeviceDisplayIdentity = Pick<
  ManagedDevice,
  "id" | "transportDeviceId" | "nodeIdHex" | "nickname"
>;

/** Returns the best stable hardware/transport/local identifier for a device. */
export function getCanonicalDeviceIdentifier(
  device: DeviceDisplayIdentity,
): string {
  const nodeIdHex = device.nodeIdHex?.trim();
  const transportDeviceId = device.transportDeviceId.trim();
  return nodeIdHex || transportDeviceId || device.id.trim();
}

/** Returns an app display name. The hardware label is intentionally ignored. */
export function getDeviceDisplayName(device: DeviceDisplayIdentity): string {
  return (
    device.nickname?.trim() || `Device ${getCanonicalDeviceIdentifier(device)}`
  );
}

/** Returns a computed profile name without mutating or persisting a default. */
export function getNetworkDisplayName(network: ManagedNetwork): string {
  return network.name.trim() || `Network ${formatPanId(network.panId)}`;
}
