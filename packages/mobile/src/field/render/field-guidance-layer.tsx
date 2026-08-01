import { Line } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";

export function FieldGuidanceLayer({
  livePosition,
  targetPosition,
  metersPerPixel,
  color,
}: {
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly targetPosition: FieldPoint;
  readonly metersPerPixel: SharedValue<number>;
  readonly color: string;
}) {
  const livePoint = useDerivedValue(() => {
    const position = livePosition.value ?? targetPosition;
    return { x: position.xMeters, y: position.yMeters };
  }, [targetPosition.xMeters, targetPosition.yMeters]);
  const targetPoint = {
    x: targetPosition.xMeters,
    y: targetPosition.yMeters,
  };
  const opacity = useDerivedValue(() =>
    livePosition.value === null ? 0 : 0.82,
  );
  const strokeWidth = useDerivedValue(() => metersPerPixel.value * 1.25);
  return (
    <Line
      p1={livePoint}
      p2={targetPoint}
      color={color}
      opacity={opacity}
      strokeWidth={strokeWidth}
    />
  );
}
