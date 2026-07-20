import type { ManagedNetwork } from "@eight2five/mobile/pans-manager/types";
import { parsePanId } from "@eight2five/mobile/pans-manager/validation";

export interface PanMigrationConfirmation {
  oldPanId: number;
  newPanId: number;
  affectedMemberCount: number;
  availableMemberCount: number;
}

export interface NetworkEditReview {
  targetPanId: number;
  confirmation?: PanMigrationConfirmation;
}

export function reviewNetworkEdit(
  network: ManagedNetwork,
  panInput: string,
  profiles: readonly ManagedNetwork[],
  affectedMemberCount: number,
  availableMemberCount: number,
): NetworkEditReview {
  const targetPanId = parsePanId(panInput);
  if (
    profiles.some(
      (profile) => profile.id !== network.id && profile.panId === targetPanId,
    )
  ) {
    throw new Error("Another saved network profile already uses that PAN ID.");
  }
  return {
    targetPanId,
    ...(targetPanId !== network.panId
      ? {
          confirmation: {
            oldPanId: network.panId,
            newPanId: targetPanId,
            affectedMemberCount,
            availableMemberCount,
          },
        }
      : {}),
  };
}

export function stablePanMigrationOperationId(
  existingId: string | undefined,
  createId: () => string,
): string {
  return existingId ?? createId();
}
