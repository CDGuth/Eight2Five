import { FieldPageDialCanvas } from "@eight2five/mobile/field/render";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import {
  getPageDialDividerSegments,
  PAGE_DIAL_START_ANGLE_DEGREES,
  PAGE_DIAL_USABLE_ARC_DEGREES,
} from "./page-dial-math";
import { getPageDialProportions } from "./page-dial-layout";

export function PageDialCanvas({
  diameter,
  pageCount,
  provisionalProgress,
  activeColor,
  trackColor,
  innerColor,
  backgroundColor,
  knobColor,
  dividerColor,
}: {
  readonly diameter: number;
  readonly pageCount: number;
  readonly provisionalProgress: SharedValue<number>;
  readonly activeColor: string;
  readonly trackColor: string;
  readonly innerColor?: string;
  readonly backgroundColor?: string;
  readonly knobColor?: string;
  readonly dividerColor?: string;
}) {
  const progress = useDerivedValue(() => {
    if (pageCount <= 0 || !Number.isFinite(provisionalProgress.value)) return 0;
    return Math.min(1, Math.max(0, provisionalProgress.value));
  });
  const proportions = getPageDialProportions(diameter);
  const dividerSegments = useMemo(
    () =>
      getPageDialDividerSegments(
        diameter,
        proportions.innerDiskDiameter,
        proportions.centerDiskDiameter,
      ),
    [diameter, proportions.centerDiskDiameter, proportions.innerDiskDiameter],
  );
  return (
    <FieldPageDialCanvas
      diameter={diameter}
      progress={progress}
      startAngleDegrees={PAGE_DIAL_START_ANGLE_DEGREES}
      usableArcDegrees={PAGE_DIAL_USABLE_ARC_DEGREES}
      activeColor={activeColor}
      trackColor={trackColor}
      innerColor={innerColor}
      backgroundColor={backgroundColor}
      knobColor={knobColor}
      dividerColor={dividerColor}
      dividerSegments={dividerSegments}
    />
  );
}
