import { Circle } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";
import type { FieldRenderPalette } from "./field-render-tokens";

export function FieldPositionLayer({
  livePosition,
  metersPerPixel,
  palette,
}: {
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
}) {
  const cx = useDerivedValue(() => livePosition.value?.xMeters ?? -1_000_000);
  const cy = useDerivedValue(() => livePosition.value?.yMeters ?? -1_000_000);
  const outerRadius = useDerivedValue(() => metersPerPixel.value * 9);
  const innerRadius = useDerivedValue(() => metersPerPixel.value * 7);
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
