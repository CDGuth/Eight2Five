import { Circle } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";
import {
  LIVE_POSITION_MARKER_DIAMETER_METERS,
  type FieldRenderPalette,
} from "./field-render-tokens";
import { STANDARD_STEP_METERS } from "../units";

export function FieldPositionLayer({
  livePosition,
  palette,
}: {
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly palette: FieldRenderPalette;
}) {
  const cx = useDerivedValue(() => livePosition.value?.xMeters ?? -1_000_000);
  const cy = useDerivedValue(() => livePosition.value?.yMeters ?? -1_000_000);
  const outerRadius = LIVE_POSITION_MARKER_DIAMETER_METERS / 2;
  const innerRadius = outerRadius - STANDARD_STEP_METERS * 0.1;
  const liveOpacity = useDerivedValue(() =>
    livePosition.value === null ? 0 : 1,
  );
  return (
    <>
      <Circle
        cx={cx}
        cy={cy}
        r={outerRadius}
        color="#FFFFFF"
        opacity={liveOpacity}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={innerRadius}
        color={palette.livePosition}
        opacity={liveOpacity}
      />
    </>
  );
}
