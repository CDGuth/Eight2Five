import { EventEmitter } from "expo-modules-core";
import { KBeacon } from "./ExpoKBeaconPro.types";

const emitter = new EventEmitter<{
  onBeaconDiscovered: (event: { beacons: KBeacon[] }) => void;
}>();

export function addBeaconDiscoveredListener(
  listener: (event: { beacons: KBeacon[] }) => void,
): any {
  console.warn("Beacon scanning is not available in the web environment.");
  return emitter.addListener("onBeaconDiscovered", listener);
}

export function startScanning(): void {
  console.warn("Beacon scanning is not available in the web environment.");
}

export function stopScanning(): void {
  console.warn("Beacon scanning is not available in the web environment.");
}

export async function connect(macAddress: string): Promise<boolean> {
  console.warn(
    "Connecting to a beacon is not available in the web environment.",
  );
  return false;
}

export async function disconnect(macAddress: string): Promise<boolean> {
  console.warn(
    "Disconnecting from a beacon is not available in the web environment.",
  );
  return true;
}
