import { Circle, Group } from "@shopify/react-native-skia";
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
  const liveTransform = useDerivedValue(() => {
    const position = livePosition.value;
    const scale = metersPerPixel.value;
    return [
      { translateX: position?.xMeters ?? -1_000_000 },
      { translateY: position?.yMeters ?? -1_000_000 },
      { scaleX: scale },
      { scaleY: -scale },
    ];
  });
  const liveOpacity = useDerivedValue(() =>
    livePosition.value === null ? 0 : 1,
  );
  return (
    <>
      <Group transform={liveTransform} opacity={liveOpacity}>
        <Circle cx={0} cy={0} r={9} color="#FFFFFF" />
        <Circle cx={0} cy={0} r={7} color={palette.livePosition} />
      </Group>
    </>
  );
}
