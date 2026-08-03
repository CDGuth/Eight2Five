import React from "react";
import { Canvas, Circle, Group, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface FieldPageDialCanvasProps {
  readonly diameter: number;
  readonly progress: SharedValue<number>;
  readonly startAngleDegrees: number;
  readonly usableArcDegrees: number;
  readonly activeColor: string;
  readonly trackColor: string;
  readonly innerColor?: string;
  readonly foregroundColor?: string;
  readonly testID?: string;
}

export function FieldPageDialCanvas({
  diameter,
  progress,
  startAngleDegrees,
  usableArcDegrees,
  activeColor,
  trackColor,
  innerColor = "#222222",
  foregroundColor = "#FFFFFF",
  testID = "page-dial-canvas",
}: FieldPageDialCanvasProps) {
  const center = diameter / 2;
  const ringThickness = diameter * 0.07;
  const ringRadius = diameter / 2 - ringThickness / 2;
  const trackPath = React.useMemo(() => {
    const inset = ringThickness / 2;
    return Skia.PathBuilder.Make()
      .addArc(
        Skia.XYWHRect(
          inset,
          inset,
          diameter - ringThickness,
          diameter - ringThickness,
        ),
        startAngleDegrees,
        usableArcDegrees,
      )
      .build();
  }, [diameter, ringThickness, startAngleDegrees, usableArcDegrees]);
  const knobX = useDerivedValue(() => {
    const angle =
      ((startAngleDegrees + progress.value * usableArcDegrees) * Math.PI) / 180;
    return center + Math.cos(angle) * ringRadius;
  });
  const knobY = useDerivedValue(() => {
    const angle =
      ((startAngleDegrees + progress.value * usableArcDegrees) * Math.PI) / 180;
    return center + Math.sin(angle) * ringRadius;
  });

  return (
    <Canvas style={{ width: diameter, height: diameter }} testID={testID}>
      <Path
        path={trackPath}
        color={trackColor}
        opacity={0.76}
        style="stroke"
        strokeCap="round"
        strokeWidth={ringThickness}
      />
      <Path
        path={trackPath}
        color={activeColor}
        end={progress}
        style="stroke"
        strokeCap="round"
        strokeWidth={ringThickness}
      />
      <Circle cx={center} cy={center} r={diameter * 0.43} color={innerColor} />
      <Group>
        <Circle
          cx={center}
          cy={center}
          r={diameter * 0.168}
          color={foregroundColor}
        />
        <Circle
          cx={center}
          cy={center}
          r={diameter * 0.15}
          color={activeColor}
        />
      </Group>
      <Circle
        cx={knobX}
        cy={knobY}
        r={diameter * 0.065}
        color={foregroundColor}
      />
    </Canvas>
  );
}
