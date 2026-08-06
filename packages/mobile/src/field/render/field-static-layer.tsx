import React from "react";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Group, Path, Rect, Text, useFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { StandardFootballFieldTemplate } from "../template";
import type { FieldPaths } from "./create-field-paths";
import type { FieldRenderPalette } from "./field-render-tokens";
import { createYardNumberTextLayout } from "./yard-number-layout";

const YARD_NUMBER_MEASUREMENT_FONT_SIZE = 100;

interface FieldStaticLayerProps {
  readonly template: StandardFootballFieldTemplate;
  readonly paths: FieldPaths;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
  readonly showPerimeterStepGrid: boolean;
  readonly showAuxiliaryFieldMarks: boolean;
}

export const FieldStaticLayer = React.memo(function FieldStaticLayer({
  template,
  paths,
  metersPerPixel,
  palette,
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
        <>
          <Path
            path={paths.hashGuideLinesPath}
            color={palette.fieldLines}
            opacity={0.74}
            style="stroke"
            strokeWidth={fieldLineStroke}
          />
          <Path
            path={paths.sidelineHashMarksPath}
            color={palette.fieldLines}
            opacity={0.74}
            style="stroke"
            strokeWidth={fieldLineStroke}
          />
        </>
      ) : null}
      <Path
        path={paths.boundaryPath}
        color={palette.fieldLines}
        style="stroke"
        strokeWidth={boundaryStroke}
      />
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
