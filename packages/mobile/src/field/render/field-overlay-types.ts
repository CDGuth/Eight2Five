import type { FieldPoint, FieldPosition } from "../types";

export interface FieldAnchorGeometry {
  readonly id: string;
  readonly position: FieldPosition;
}

export interface FieldAnchorOverlayOptions {
  readonly visible: boolean;
  readonly showRange: boolean;
  readonly rangeMeters: number;
}

export const HIDDEN_FIELD_ANCHOR_OVERLAY: FieldAnchorOverlayOptions =
  Object.freeze({
    visible: false,
    showRange: false,
    rangeMeters: 0,
  });

export interface FieldDrillOverlayState {
  readonly drillFeaturesEnabled: boolean;
  readonly hasActiveDrill: boolean;
  readonly hasSelectedPage: boolean;
  readonly hasLivePosition: boolean;
  readonly guidanceEnabled: boolean;
}

export type CurrentTargetMarkerSource =
  | "drill-scene"
  | "legacy-fallback"
  | "none";

export interface CurrentTargetMarkerPolicyInput {
  readonly fullDrillSceneAvailable: boolean;
  readonly sceneHasCurrent: boolean;
  readonly legacyFallbackAvailable: boolean;
}

/**
 * A complete scene owns the selected target, even when its current position is
 * missing. This prevents a stale local fallback from drawing a duplicate or
 * misleading target on top of a document-backed scene.
 */
export function getCurrentTargetMarkerSource({
  fullDrillSceneAvailable,
  sceneHasCurrent,
  legacyFallbackAvailable,
}: CurrentTargetMarkerPolicyInput): CurrentTargetMarkerSource {
  if (fullDrillSceneAvailable) {
    return sceneHasCurrent ? "drill-scene" : "none";
  }
  return legacyFallbackAvailable ? "legacy-fallback" : "none";
}

export function resolveCurrentTargetPosition({
  fullDrillSceneAvailable,
  sceneCurrent,
  legacyFallback,
}: {
  readonly fullDrillSceneAvailable: boolean;
  readonly sceneCurrent?: FieldPoint | null;
  readonly legacyFallback?: FieldPoint;
}): FieldPoint | undefined {
  const source = getCurrentTargetMarkerSource({
    fullDrillSceneAvailable,
    sceneHasCurrent: sceneCurrent !== undefined && sceneCurrent !== null,
    legacyFallbackAvailable: legacyFallback !== undefined,
  });
  if (source === "drill-scene") return sceneCurrent ?? undefined;
  if (source === "legacy-fallback") return legacyFallback;
  return undefined;
}

export function shouldShowFieldGuidanceForScene(
  state: FieldDrillOverlayState,
  targetPolicy: CurrentTargetMarkerPolicyInput,
): boolean {
  return (
    shouldShowFieldGuidance(state) &&
    getCurrentTargetMarkerSource(targetPolicy) !== "none"
  );
}

export function shouldShowFieldTarget(state: FieldDrillOverlayState): boolean {
  return (
    state.drillFeaturesEnabled && state.hasActiveDrill && state.hasSelectedPage
  );
}

export function shouldShowFieldGuidance(
  state: FieldDrillOverlayState,
): boolean {
  return (
    shouldShowFieldTarget(state) &&
    state.hasLivePosition &&
    state.guidanceEnabled
  );
}
