import type { FieldAnchorOverlayOptions } from "@eight2five/mobile/field";
import {
  getEffectiveDeveloperOverlaySettings,
  type AppSettings,
} from "@eight2five/mobile/settings";

export function fieldAnchorOverlayOptions(
  settings: AppSettings,
): FieldAnchorOverlayOptions {
  const effective = getEffectiveDeveloperOverlaySettings(settings);
  return {
    visible: effective.showCachedAnchorGeometry,
    showRange: effective.showComfortableAnchorRange,
    rangeMeters: settings.comfortableAnchorRangeMeters,
  };
}
