import React from "react";
import { Group, matchFont, Path, Rect, Text } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { StandardHighSchoolFieldTemplate } from "../template";
import type { FieldPaths } from "./create-field-paths";
import type { FieldRenderPalette } from "./field-render-tokens";

interface FieldStaticLayerProps {
  readonly template: StandardHighSchoolFieldTemplate;
  readonly paths: FieldPaths;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
}

export const FieldStaticLayer = React.memo(function FieldStaticLayer({
  template,
  paths,
  metersPerPixel,
  palette,
}: FieldStaticLayerProps) {
  const stepGridStroke = useDerivedValue(() => metersPerPixel.value * 0.7);
  const fiveYardStroke = useDerivedValue(() => metersPerPixel.value * 1.1);
  const fieldLineStroke = useDerivedValue(() => metersPerPixel.value * 1.4);
  const boundaryStroke = useDerivedValue(() => metersPerPixel.value * 2);
  const numberFont = React.useMemo(
    () =>
      matchFont({
        fontFamily: "Montserrat",
        fontSize: template.dimensions.yardNumberHeightMeters,
        fontWeight: "600",
      }),
    [template],
  );
  const fieldClip = {
    x: template.bounds.minXMeters,
    y: template.bounds.minYMeters,
    width: template.goalToGoalMeters,
    height: template.widthMeters,
  };

  return (
    <>
      <Path
        path={paths.stepGridPath}
        color={palette.stepGrid}
        style="stroke"
        strokeWidth={stepGridStroke}
      />
      <Rect {...fieldClip} color={palette.fieldBackground} />
      <Group clip={fieldClip}>
        <Path
          path={paths.fiveYardGridPath}
          color={palette.fiveYardGrid}
          opacity={0.46}
          style="stroke"
          strokeWidth={fiveYardStroke}
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
      <Path
        path={paths.boundaryPath}
        color={palette.fieldLines}
        style="stroke"
        strokeWidth={boundaryStroke}
      />
      {template.yardNumbers.map((number) => {
        const width = numberFont.measureText(number.label).width;
        return (
          <Group
            key={`${number.side}-${number.xMeters}`}
            transform={[
              { translateX: number.xMeters },
              { translateY: number.yMeters },
              { scaleY: -1 },
            ]}
          >
            <Text
              x={-width / 2}
              y={template.dimensions.yardNumberHeightMeters / 2}
              text={number.label}
              font={numberFont}
              color={palette.fieldNumbers}
              opacity={0.72}
            />
          </Group>
        );
      })}
    </>
  );
});
