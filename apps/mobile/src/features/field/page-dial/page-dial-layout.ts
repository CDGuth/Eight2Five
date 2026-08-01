import { getDrillTerms, type DrillTerminology } from "@eight2five/mobile/drill";

export interface PageDialProportions {
  readonly ringThickness: number;
  readonly innerDiskDiameter: number;
  readonly centerDiskDiameter: number;
  readonly centerBorderWidth: number;
  readonly knobDiameter: number;
  readonly controlCenterOffset: number;
}

export function getPageDialProportions(diameter: number): PageDialProportions {
  return {
    ringThickness: diameter * 0.07,
    innerDiskDiameter: diameter * 0.86,
    centerDiskDiameter: diameter * 0.3,
    centerBorderWidth: diameter * 0.018,
    knobDiameter: diameter * 0.13,
    controlCenterOffset: diameter * 0.29,
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
