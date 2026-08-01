import { FieldPageDialCanvas } from "@eight2five/mobile/field/render";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import {
  normalizePageIndex,
  PAGE_DIAL_START_ANGLE_DEGREES,
  PAGE_DIAL_USABLE_ARC_DEGREES,
} from "./page-dial-math";

export function PageDialCanvas({
  diameter,
  pageCount,
  provisionalIndex,
  activeColor,
  trackColor,
}: {
  readonly diameter: number;
  readonly pageCount: number;
  readonly provisionalIndex: SharedValue<number>;
  readonly activeColor: string;
  readonly trackColor: string;
}) {
  const progress = useDerivedValue(() =>
    normalizePageIndex(provisionalIndex.value, pageCount),
  );
  return (
    <FieldPageDialCanvas
      diameter={diameter}
      progress={progress}
      startAngleDegrees={PAGE_DIAL_START_ANGLE_DEGREES}
      usableArcDegrees={PAGE_DIAL_USABLE_ARC_DEGREES}
      activeColor={activeColor}
      trackColor={trackColor}
    />
  );
}
