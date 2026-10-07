import { Circle } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";
import {
  DRILL_MARKER_SIZE_METERS,
  type FieldRenderPalette,
} from "./field-render-tokens";

export function FieldPositionLayer({
  livePosition,
  palette,
}: {
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly palette: FieldRenderPalette;
}) {
  const cx = useDerivedValue(() => livePosition.value?.xMeters ?? -1_000_000);
  const cy = useDerivedValue(() => livePosition.value?.yMeters ?? -1_000_000);
  const radius = DRILL_MARKER_SIZE_METERS.transitionDiameter / 2;
  const liveOpacity = useDerivedValue(() =>
    livePosition.value === null ? 0 : 1,
  );
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
      color={palette.livePosition}
      opacity={liveOpacity}
    />
  );
}
