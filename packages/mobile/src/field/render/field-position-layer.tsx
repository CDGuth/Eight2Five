import { Circle, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";
import type { FieldRenderPalette } from "./field-render-tokens";

export function FieldPositionLayer({
  livePosition,
  targetPosition,
  metersPerPixel,
  palette,
}: {
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly targetPosition?: FieldPoint;
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
  const targetTransform = useDerivedValue(() => {
    const scale = metersPerPixel.value;
    return [
      { translateX: targetPosition?.xMeters ?? -1_000_000 },
      { translateY: targetPosition?.yMeters ?? -1_000_000 },
      { scaleX: scale },
      { scaleY: -scale },
    ];
  }, [targetPosition?.xMeters, targetPosition?.yMeters]);

  return (
    <>
      {targetPosition ? (
        <Group transform={targetTransform}>
          <Path
            path="M 0 -10 L 10 0 L 0 10 L -10 0 Z"
            color={palette.target}
            style="stroke"
            strokeWidth={3}
          />
          <Circle cx={0} cy={0} r={2.5} color={palette.target} />
        </Group>
      ) : null}
      <Group transform={liveTransform} opacity={liveOpacity}>
        <Circle cx={0} cy={0} r={9} color="#FFFFFF" />
        <Circle cx={0} cy={0} r={7} color={palette.livePosition} />
      </Group>
    </>
  );
}
