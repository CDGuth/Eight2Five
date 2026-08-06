import React from "react";
import { Canvas, Circle, Path, Shadow, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface FieldPageDialPoint {
  readonly x: number;
  readonly y: number;
}

export interface FieldPageDialLineSegment {
  readonly start: FieldPageDialPoint;
  readonly end: FieldPageDialPoint;
}

export interface FieldPageDialCanvasProps {
  readonly diameter: number;
  readonly progress: SharedValue<number>;
  readonly startAngleDegrees: number;
  readonly usableArcDegrees: number;
  readonly activeColor: string;
  readonly trackColor: string;
  readonly innerColor?: string;
  readonly backgroundColor?: string;
  readonly knobColor?: string;
  readonly showKnob?: boolean;
  readonly dividerColor?: string;
  readonly dividerSegments?: readonly FieldPageDialLineSegment[];
  readonly testID?: string;
}

const INNER_DISK_DIAMETER_RATIO = 0.86;
const CENTER_DISK_DIAMETER_RATIO = 0.3;
const RING_THICKNESS_RATIO = 0.075;
const KNOB_DIAMETER_RATIO = 0.16;
const CANVAS_OVERSCAN_RATIO = 0.09;
const DIVIDER_STROKE_RATIO = 0.012;
const ACTIVE_OVERLAP_PROGRESS = 0.008;

function pointAtRadius(
  diameter: number,
  angleDegrees: number,
  radius: number,
): FieldPageDialPoint {
  const center = diameter / 2;
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function getDefaultDividerSegments(
  diameter: number,
): readonly FieldPageDialLineSegment[] {
  const outerRadius = (diameter * INNER_DISK_DIAMETER_RATIO) / 2;
  const innerRadius = (diameter * CENTER_DISK_DIAMETER_RATIO) / 2;
  return [
    {
      start: pointAtRadius(diameter, -135, outerRadius),
      end: pointAtRadius(diameter, -135, innerRadius),
    },
    {
      start: pointAtRadius(diameter, -45, outerRadius),
      end: pointAtRadius(diameter, -45, innerRadius),
    },
    {
      start: pointAtRadius(diameter, 45, innerRadius),
      end: pointAtRadius(diameter, 45, outerRadius),
    },
    {
      start: pointAtRadius(diameter, 135, innerRadius),
      end: pointAtRadius(diameter, 135, outerRadius),
    },
  ];
}

export function FieldPageDialCanvas({
  diameter,
  progress,
  startAngleDegrees,
  usableArcDegrees,
  activeColor,
  trackColor,
  innerColor = "#222222",
  backgroundColor = "transparent",
  knobColor = "#FFFFFF",
  showKnob = true,
  dividerColor = "rgba(255,255,255,0.28)",
  dividerSegments,
  testID = "page-dial-canvas",
}: FieldPageDialCanvasProps) {
  const ringThickness = diameter * RING_THICKNESS_RATIO;
  const ringRadius = diameter / 2 - ringThickness / 2;
  const knobRadius = (diameter * KNOB_DIAMETER_RATIO) / 2;
  const canvasOverscan = diameter * CANVAS_OVERSCAN_RATIO;
  const canvasDiameter = diameter + canvasOverscan * 2;
  const center = canvasDiameter / 2;
  const innerDiskRadius = (diameter * INNER_DISK_DIAMETER_RATIO) / 2;
  const centerDiskRadius = (diameter * CENTER_DISK_DIAMETER_RATIO) / 2;
  const segments = dividerSegments ?? getDefaultDividerSegments(diameter);

  const trackPath = React.useMemo(() => {
    const inset = canvasOverscan + ringThickness / 2;
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
  }, [
    canvasOverscan,
    diameter,
    ringThickness,
    startAngleDegrees,
    usableArcDegrees,
  ]);

  const dividerPaths = React.useMemo(
    () =>
      segments.map(({ start, end }) =>
        Skia.PathBuilder.Make()
          .moveTo(start.x + canvasOverscan, start.y + canvasOverscan)
          .lineTo(end.x + canvasOverscan, end.y + canvasOverscan)
          .build(),
      ),
    [canvasOverscan, segments],
  );

  const normalizedProgress = useDerivedValue(() => {
    const value = progress.value;
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  });
  const activeProgress = useDerivedValue(() => {
    const value = normalizedProgress.value;
    return Math.min(
      1,
      Math.max(ACTIVE_OVERLAP_PROGRESS, value + ACTIVE_OVERLAP_PROGRESS),
    );
  });
  const knobX = useDerivedValue(() => {
    const angle =
      ((startAngleDegrees + normalizedProgress.value * usableArcDegrees) *
        Math.PI) /
      180;
    return center + Math.cos(angle) * ringRadius;
  });
  const knobY = useDerivedValue(() => {
    const angle =
      ((startAngleDegrees + normalizedProgress.value * usableArcDegrees) *
        Math.PI) /
      180;
    return center + Math.sin(angle) * ringRadius;
  });
  return (
    <Canvas
      style={{
        position: "absolute",
        left: -canvasOverscan,
        top: -canvasOverscan,
        width: canvasDiameter,
        height: canvasDiameter,
      }}
      testID={testID}
    >
      <Circle
        cx={center}
        cy={center}
        r={diameter / 2}
        color={backgroundColor}
      />
      <Circle cx={center} cy={center} r={innerDiskRadius} color={innerColor} />

      {/* Paint the complete track first, then overlap it with the active arc. */}
      <Path
        path={trackPath}
        color={trackColor}
        opacity={0.78}
        style="stroke"
        strokeCap="round"
        strokeWidth={ringThickness}
      />
      <Path
        path={trackPath}
        color={activeColor}
        end={activeProgress}
        style="stroke"
        strokeCap="round"
        strokeWidth={ringThickness}
      />

      {dividerPaths.map((path, index) => (
        <Path
          key={`page-dial-divider-${index}`}
          path={path}
          color={dividerColor}
          style="stroke"
          strokeCap="butt"
          strokeWidth={Math.max(1, diameter * DIVIDER_STROKE_RATIO)}
        />
      ))}

      {/* The center disk is drawn last so the X ends exactly at its edge. */}
      <Circle
        cx={center}
        cy={center}
        r={centerDiskRadius}
        color={activeColor}
      />

      {/* A larger, overscanned knob keeps its soft offset shadow inside the canvas. */}
      {showKnob ? (
        <Circle cx={knobX} cy={knobY} r={knobRadius} color={knobColor}>
          <Shadow
            dx={diameter * 0.012}
            dy={diameter * 0.018}
            blur={diameter * 0.018}
            color="rgba(0,0,0,0.22)"
          />
        </Circle>
      ) : null}
    </Canvas>
  );
}
