import { getDrillTerms, type DrillTerminology } from "@eight2five/mobile/drill";

import {
  getPageDialCanvasOverscan,
  getPageDialControlSize,
  getPageDialRingHitRegion,
  getPageDialRingRadius,
  PAGE_DIAL_CENTER_DISK_DIAMETER_RATIO,
  PAGE_DIAL_CONTROL_CENTER_OFFSET_RATIO,
  PAGE_DIAL_INNER_DISK_DIAMETER_RATIO,
  PAGE_DIAL_KNOB_DIAMETER_RATIO,
  PAGE_DIAL_RING_THICKNESS_RATIO,
} from "./page-dial-math";

export interface PageDialProportions {
  readonly ringThickness: number;
  readonly ringRadius: number;
  readonly innerDiskDiameter: number;
  readonly centerDiskDiameter: number;
  /** Kept for callers that used the original proportions API. No outline is rendered. */
  readonly centerBorderWidth: number;
  readonly knobDiameter: number;
  readonly knobRadius: number;
  readonly controlCenterOffset: number;
  readonly controlButtonSize: number;
  readonly ringHitInnerRadius: number;
  readonly ringHitOuterRadius: number;
  readonly canvasOverscan: number;
}

export function getPageDialProportions(diameter: number): PageDialProportions {
  const ringThickness = diameter * PAGE_DIAL_RING_THICKNESS_RATIO;
  const innerDiskDiameter = diameter * PAGE_DIAL_INNER_DISK_DIAMETER_RATIO;
  const centerDiskDiameter = diameter * PAGE_DIAL_CENTER_DISK_DIAMETER_RATIO;
  const knobDiameter = diameter * PAGE_DIAL_KNOB_DIAMETER_RATIO;
  const ringHitRegion = getPageDialRingHitRegion(diameter);
  return {
    ringThickness,
    ringRadius: getPageDialRingRadius(diameter, ringThickness),
    innerDiskDiameter,
    centerDiskDiameter,
    centerBorderWidth: 0,
    knobDiameter,
    knobRadius: knobDiameter / 2,
    controlCenterOffset: diameter * PAGE_DIAL_CONTROL_CENTER_OFFSET_RATIO,
    controlButtonSize: getPageDialControlSize(diameter),
    ringHitInnerRadius: ringHitRegion.innerRadius,
    ringHitOuterRadius: ringHitRegion.outerRadius,
    canvasOverscan: getPageDialCanvasOverscan(diameter),
  };
}

export function getPageDialControlState(
  selectedIndex: number,
  pageCount: number,
): { previousDisabled: boolean; nextDisabled: boolean } {
  return {
    previousDisabled: selectedIndex <= 0,
    nextDisabled:
      pageCount <= 0 || (selectedIndex >= 0 && selectedIndex >= pageCount - 1),
  };
}

export function getPageDialAccessibilityLabel({
  selectedIndex,
  selectedLabel,
  pageCount,
  terminology,
}: {
  readonly selectedIndex: number;
  readonly selectedLabel?: string;
  readonly pageCount: number;
  readonly terminology: DrillTerminology;
}): string {
  const terms = getDrillTerms(terminology);
  if (selectedIndex < 0) {
    return `${terms.singular} selector, no ${terms.lowercaseSingular} selected, ${pageCount} available`;
  }
  return `${terms.singular} selector, ${terms.lowercaseSingular} ${selectedLabel ?? selectedIndex + 1} of ${pageCount}`;
}
