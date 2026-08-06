import React from "react";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import {
  Group,
  Path,
  Rect,
  Text,
  useFont,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { FieldCameraPerspective } from "../camera/field-camera-types";
import type { StandardFootballFieldTemplate } from "../template";
import type { FieldPaths } from "./create-field-paths";
import type { FieldRenderPalette } from "./field-render-tokens";
import { createYardNumberTextLayout } from "./yard-number-layout";

const YARD_NUMBER_MEASUREMENT_FONT_SIZE = 100;
const SIDELINE_LABEL_FONT_SIZE_PX = 11;
const SIDELINE_LABEL_INSET_PX = 6;

interface FieldStaticLayerProps {
  readonly template: StandardFootballFieldTemplate;
  readonly paths: FieldPaths;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
  readonly showPerimeterStepGrid: boolean;
  readonly showAuxiliaryFieldMarks: boolean;
}

export const FieldStaticLayer = React.memo(function FieldStaticLayer({
  template,
  paths,
  metersPerPixel,
  palette,
  perspective,
  showPerimeterStepGrid,
  showAuxiliaryFieldMarks,
}: FieldStaticLayerProps) {
  const stepGridStroke = useDerivedValue(() => metersPerPixel.value * 0.7);
  const fourStepStroke = useDerivedValue(() => metersPerPixel.value * 1.1);
  const fieldLineStroke = useDerivedValue(() => metersPerPixel.value * 1.4);
  const boundaryStroke = useDerivedValue(() => metersPerPixel.value * 2);
  // Measure/draw from a large, fixed reference size and scale into world
  // meters afterward. Measuring Montserrat at ~1.83 "font units" (six feet)
  // is small enough for hinting/rounding to distort the glyph bounds on some
  // platforms, which made the painted numbers undersized and slightly offset.
  const numberFont = useFont(
    Montserrat_600SemiBold,
    YARD_NUMBER_MEASUREMENT_FONT_SIZE,
  );
  const sidelineFont = useFont(
    Montserrat_600SemiBold,
    SIDELINE_LABEL_FONT_SIZE_PX,
  );
  const fieldClip = {
    x: template.bounds.minXMeters,
    y: template.bounds.minYMeters,
    width: template.goalToGoalMeters,
    height: template.widthMeters,
  };
  const perimeterClip = {
    x: paths.gridExtent.minXMeters,
    y: paths.gridExtent.minYMeters,
    width: paths.gridExtent.maxXMeters - paths.gridExtent.minXMeters,
    height: paths.gridExtent.maxYMeters - paths.gridExtent.minYMeters,
  };

  return (
    <>
      {showPerimeterStepGrid ? (
        <Group clip={perimeterClip}>
          <Path
            path={paths.perimeterStepGridPath}
            color={palette.stepGrid}
            style="stroke"
            strokeWidth={stepGridStroke}
          />
        </Group>
      ) : null}
      <Rect {...fieldClip} color={palette.fieldBackground} />
      <Group clip={fieldClip}>
        <Path
          path={paths.stepGridPath}
          color={palette.stepGrid}
          style="stroke"
          strokeWidth={stepGridStroke}
        />
        <Path
          path={paths.fourStepGridPath}
          color={palette.fourStepGrid}
          opacity={0.46}
          style="stroke"
          strokeWidth={fourStepStroke}
        />
      </Group>
      <Path
        path={paths.yardLinesPath}
        color={palette.fieldLines}
        opacity={0.72}
        style="stroke"
        strokeWidth={fieldLineStroke}
      />
      <Path
        path={paths.hashMarksPath}
        color={palette.fieldLines}
        opacity={0.74}
        style="stroke"
        strokeWidth={fieldLineStroke}
      />
      {showAuxiliaryFieldMarks ? (
        <Path
          path={paths.sidelineHashMarksPath}
          color={palette.fieldLines}
          opacity={0.74}
          style="stroke"
          strokeWidth={fieldLineStroke}
        />
      ) : null}
      <Path
        path={paths.boundaryPath}
        color={palette.fieldLines}
        style="stroke"
        strokeWidth={boundaryStroke}
      />
      {sidelineFont ? (
        <>
          <SidelineLabel
            text="FRONT SIDELINE"
            yMeters={template.bounds.minYMeters}
            atTop={perspective === "performer"}
            perspective={perspective}
            metersPerPixel={metersPerPixel}
            font={sidelineFont}
            color={palette.fieldNumbers}
          />
          <SidelineLabel
            text="BACK SIDELINE"
            yMeters={template.bounds.maxYMeters}
            atTop={perspective === "director"}
            perspective={perspective}
            metersPerPixel={metersPerPixel}
            font={sidelineFont}
            color={palette.fieldNumbers}
          />
        </>
      ) : null}
      {numberFont
        ? template.yardNumbers.map((number) => {
            const layout = createYardNumberTextLayout(
              numberFont.measureText(number.label),
              number.heightMeters,
            );
            return (
              <Group
                key={`${number.side}-${number.xMeters}`}
                transform={[
                  { translateX: number.xMeters },
                  { translateY: number.yMeters },
                ]}
              >
                <Group
                  transform={[
                    { scaleX: layout.scaleX },
                    { scaleY: layout.scaleY },
                  ]}
                >
                  <Text
                    x={layout.x}
                    y={layout.y}
                    text={number.label}
                    font={numberFont}
                    color={palette.fieldNumbers}
                    opacity={0.72}
                  />
                </Group>
              </Group>
            );
          })
        : null}
    </>
  );
});

function SidelineLabel({
  text,
  yMeters,
  atTop,
  perspective,
  metersPerPixel,
  font,
  color,
}: {
  readonly text: string;
  readonly yMeters: number;
  readonly atTop: boolean;
  readonly perspective: FieldCameraPerspective;
  readonly metersPerPixel: SharedValue<number>;
  readonly font: SkFont;
  readonly color: string;
}) {
  const width = font.measureText(text).width;
  const transform = useDerivedValue(() => {
    const scale = metersPerPixel.value;
    return perspective === "performer"
      ? [{ scaleX: -scale }, { scaleY: scale }]
      : [{ scaleX: scale }, { scaleY: -scale }];
  });
  const baselineOffset = atTop
    ? SIDELINE_LABEL_FONT_SIZE_PX + SIDELINE_LABEL_INSET_PX
    : -SIDELINE_LABEL_INSET_PX;

  return (
    <Group origin={{ x: 0, y: yMeters }} transform={transform} opacity={0.78}>
      <Text
        x={-width / 2}
        y={yMeters + baselineOffset}
        text={text}
        font={font}
        color={color}
      />
    </Group>
  );
}
