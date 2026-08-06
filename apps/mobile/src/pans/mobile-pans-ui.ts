import type { DiscoveredDeviceSnapshot } from "@eight2five/mobile/pans-manager";

import type { TagConnectionState } from "./mobile-pans-model";

export type ConnectionStatusIcon =
  | "connected"
  | "searching"
  | "connecting"
  | "disconnected"
  | "error";

export interface ConnectionStatusViewModel {
  readonly label: string;
  readonly icon: ConnectionStatusIcon;
  readonly tone: "success" | "accent" | "muted" | "danger";
  readonly animated: boolean;
}

export function connectionStatusViewModel(
  state: TagConnectionState,
): ConnectionStatusViewModel {
  switch (state) {
    case "connected":
      return {
        label: "Connected",
        icon: "connected",
        tone: "success",
        animated: false,
      };
    case "scanning":
      return {
        label: "Searching",
        icon: "searching",
        tone: "accent",
        animated: true,
      };
    case "connecting":
      return {
        label: "Connecting",
        icon: "connecting",
        tone: "accent",
        animated: false,
      };
    case "reconnecting":
      return {
        label: "Reconnecting",
        icon: "connecting",
        tone: "accent",
        animated: false,
      };
    case "error":
      return {
        label: "Connection error",
        icon: "error",
        tone: "danger",
        animated: false,
      };
    case "idle":
    case "disconnected":
      return {
        label: "Disconnected",
        icon: "disconnected",
        tone: "muted",
        animated: false,
      };
  }
}

export type SignalStrength = "full" | "high" | "medium" | "low";

export function signalStrengthForRssi(
  rssi: number,
  cutoff: number,
): SignalStrength {
  const aboveCutoff = rssi - cutoff;
  if (aboveCutoff >= 40) return "full";
  if (aboveCutoff >= 25) return "high";
  if (aboveCutoff >= 10) return "medium";
  return "low";
}

export function selectVisibleDiscoveries(
  discoveries: readonly DiscoveredDeviceSnapshot[],
  options: { readonly developerMode: boolean; readonly cutoff: number },
): readonly DiscoveredDeviceSnapshot[] {
  return discoveries
    .filter(
      (device) =>
        !device.stale &&
        device.compatibility === "compatible" &&
        device.rssi >= options.cutoff &&
        (options.developerMode || device.presence?.role === "tag"),
    )
    .sort((left, right) => right.rssi - left.rssi);
}
