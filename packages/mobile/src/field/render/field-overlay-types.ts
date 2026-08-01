import type { FieldPosition } from "../types";

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
