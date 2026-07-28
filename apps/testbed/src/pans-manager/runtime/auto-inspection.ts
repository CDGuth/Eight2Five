import type { DiscoveredDeviceSnapshot } from "@eight2five/mobile/pans-manager";

export const AUTO_INSPECTION_RETRY_BASE_MS = 1_000;
export const AUTO_INSPECTION_RETRY_MAX_MS = 30_000;
export const INSPECTION_COOLDOWN_MS = 5_000;

export function autoInspectionRetryDelay(failureCount: number) {
  return Math.min(
    AUTO_INSPECTION_RETRY_BASE_MS * 2 ** (failureCount - 1),
    AUTO_INSPECTION_RETRY_MAX_MS,
  );
}

export function availableDiscoveryTransportIds(
  discoveries: DiscoveredDeviceSnapshot[],
) {
  return new Set(
    discoveries
      .filter(
        (item) =>
          item.stale !== true &&
          item.compatibility !== "malformed" &&
          item.transportDeviceId,
      )
      .map((item) => item.transportDeviceId),
  );
}
