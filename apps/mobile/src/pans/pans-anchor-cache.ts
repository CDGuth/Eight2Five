import type { FieldAnchorGeometry } from "@eight2five/mobile/field";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

/**
 * Selects only anchors explicitly associated with the remembered tag's saved
 * network, falling back to a verified cached PAN ID when no profile exists.
 */
export function selectNetworkAnchors(
  rememberedTag: ManagedDevice | undefined,
  knownAnchors: readonly ManagedDevice[],
): readonly ManagedDevice[] {
  if (!rememberedTag) return [];
  if (rememberedTag.networkId) {
    return knownAnchors.filter(
      (anchor) => anchor.networkId === rememberedTag.networkId,
    );
  }
  const panId = rememberedTag.lastKnownConfig?.panId;
  if (panId === undefined) return [];
  return knownAnchors.filter(
    (anchor) => anchor.lastKnownConfig?.panId === panId,
  );
}

export function cachedAnchorGeometry(
  rememberedTag: ManagedDevice | undefined,
  knownAnchors: readonly ManagedDevice[],
): readonly FieldAnchorGeometry[] {
  return selectNetworkAnchors(rememberedTag, knownAnchors).flatMap((anchor) => {
    const position =
      anchor.lastKnownConfig?.role === "anchor"
        ? anchor.lastKnownConfig.position
        : undefined;
    if (
      !position ||
      !Number.isFinite(position.xMeters) ||
      !Number.isFinite(position.yMeters)
    ) {
      return [];
    }
    return [
      {
        id: anchor.id,
        position: {
          xMeters: position.xMeters,
          yMeters: position.yMeters,
          zMeters: position.zMeters,
        },
      },
    ];
  });
}
