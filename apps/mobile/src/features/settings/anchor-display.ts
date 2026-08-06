import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

export function getDeveloperAnchorDisplayName(anchor: ManagedDevice): string {
  return (
    anchor.lastKnownConfig?.label?.trim() ||
    anchor.label?.trim() ||
    anchor.nodeIdHex?.trim() ||
    anchor.id
  );
}
