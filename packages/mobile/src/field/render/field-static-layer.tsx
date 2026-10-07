import React from "react";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import {
  Group,
  Path,
  Rect,
  Text,
  useFont,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { StandardFootballFieldTemplate } from "../template";
import type { FieldCameraPerspective } from "../camera/field-camera-types";
import type { FieldPaths } from "./create-field-paths";
import {
  FIELD_NUMBER_OPACITY,
  getFixedWorldLabelGapUnits,
  getResponsiveSidelineLabelScale,
  type FieldRenderPalette,
} from "./field-render-tokens";
import { createYardNumberTextLayout } from "./yard-number-layout";

const YARD_NUMBER_MEASUREMENT_FONT_SIZE = 100;
const SIDELINE_LABEL_FONT_SIZE_PX = 88;
const SIDELINE_LABEL_INSET_PX = 96;

interface FieldStaticLayerProps {
  readonly template: StandardFootballFieldTemplate;
  readonly paths: FieldPaths;
  readonly metersPerPixel: SharedValue<number>;
  readonly canvasSize: SharedValue<{
    readonly width: number;
    readonly height: number;
  }>;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
  readonly showFiveYardNumbers: boolean;
  readonly showPerimeterStepGrid: boolean;
  readonly showAuxiliaryFieldMarks: boolean;
}

export const FieldStaticLayer = React.memo(function FieldStaticLayer({
  template,
  paths,
  metersPerPixel,
  canvasSize,
  palette,
  perspective,
  showFiveYardNumbers,
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
  const sidelineFont = useFont(Montserrat_700Bold, SIDELINE_LABEL_FONT_SIZE_PX);
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
        <>
          <Group clip={perimeterClip}>
            <Path
              path={paths.perimeterStepGridPath}
              color={palette.stepGrid}
              style="stroke"
              strokeWidth={stepGridStroke}
            />
            <Path
              path={paths.perimeterFourStepGridPath}
              color={palette.fourStepGrid}
              opacity={0.46}
              style="stroke"
              strokeWidth={fourStepStroke}
            />
          </Group>
          <Path
            path={paths.perimeterBoundaryPath}
            color={
              paths.perimeterBoundaryUsesFourStepStyle
                ? palette.fourStepGrid
                : palette.stepGrid
            }
            opacity={paths.perimeterBoundaryUsesFourStepStyle ? 0.46 : 1}
            style="stroke"
            strokeWidth={
              paths.perimeterBoundaryUsesFourStepStyle
                ? fourStepStroke
                : stepGridStroke
            }
          />
        </>
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
            side="front"
            font={sidelineFont}
            color={palette.fieldNumbers}
            perspective={perspective}
            metersPerPixel={metersPerPixel}
            canvasSize={canvasSize}
            gridExtent={paths.gridExtent}
          />
          <SidelineLabel
            text="BACK SIDELINE"
            yMeters={template.bounds.maxYMeters}
            side="back"
            font={sidelineFont}
            color={palette.fieldNumbers}
            perspective={perspective}
            metersPerPixel={metersPerPixel}
            canvasSize={canvasSize}
            gridExtent={paths.gridExtent}
          />
        </>
      ) : null}
      {numberFont
        ? (showFiveYardNumbers
            ? template.fiveYardNumbers
            : template.yardNumbers
          ).map((number) => {
            const layout = createYardNumberTextLayout(
              numberFont.measureText(number.label),
              number.heightMeters,
              number.side,
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
                    opacity={FIELD_NUMBER_OPACITY}
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
  side,
  font,
  color,
  perspective,
  metersPerPixel,
  canvasSize,
  gridExtent,
}: {
  readonly text: string;
  readonly yMeters: number;
  readonly side: "front" | "back";
  readonly font: SkFont;
  readonly color: string;
  readonly perspective: FieldCameraPerspective;
  readonly metersPerPixel: SharedValue<number>;
  readonly canvasSize: SharedValue<{
    readonly width: number;
    readonly height: number;
  }>;
  readonly gridExtent: FieldPaths["gridExtent"];
}) {
  const bounds = font.measureText(text);
  const orientation = perspective === "director" ? 1 : -1;
  const transform = useDerivedValue(() => {
    const viewport = canvasSize.value;
    const defaultMetersPerPixel =
      viewport.width > 0 && viewport.height > 0
        ? Math.max(
            (gridExtent.maxXMeters - gridExtent.minXMeters) / viewport.width,
            (gridExtent.maxYMeters - gridExtent.minYMeters) / viewport.height,
          ) * 1.06
        : metersPerPixel.value;
    const scale = getResponsiveSidelineLabelScale(
      metersPerPixel.value,
      defaultMetersPerPixel,
      bounds.width,
      viewport.width,
    );
    return [{ scaleX: scale * orientation }, { scaleY: -scale * orientation }];
  });
  const isLowerScreenEdge =
    perspective === "director" ? side === "front" : side === "back";
  const baselineOffset = isLowerScreenEdge
    ? -bounds.y
    : -(bounds.y + bounds.height);
  const insetTransform = useDerivedValue(() => {
    const viewport = canvasSize.value;
    const defaultMetersPerPixel =
      viewport.width > 0 && viewport.height > 0
        ? Math.max(
            (gridExtent.maxXMeters - gridExtent.minXMeters) / viewport.width,
            (gridExtent.maxYMeters - gridExtent.minYMeters) / viewport.height,
          ) * 1.06
        : metersPerPixel.value;
    const scale = getResponsiveSidelineLabelScale(
      metersPerPixel.value,
      defaultMetersPerPixel,
      bounds.width,
      viewport.width,
    );
    const defaultScale = getResponsiveSidelineLabelScale(
      defaultMetersPerPixel,
      defaultMetersPerPixel,
      bounds.width,
      viewport.width,
    );
    const insetUnits = getFixedWorldLabelGapUnits(
      scale,
      defaultScale,
      SIDELINE_LABEL_INSET_PX,
    );
    return [{ translateY: isLowerScreenEdge ? insetUnits : -insetUnits }];
  });

  return (
    <Group origin={{ x: 0, y: yMeters }} transform={transform} opacity={0.78}>
      <Group transform={insetTransform}>
        <Text
          x={-bounds.x - bounds.width / 2}
          y={yMeters + baselineOffset}
          text={text}
          font={font}
          color={color}
        />
      </Group>
    </Group>
  );
}
