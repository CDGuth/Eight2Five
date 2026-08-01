import React from "react";
import { Circle, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type {
  FieldAnchorGeometry,
  FieldAnchorOverlayOptions,
} from "./field-overlay-types";
import type { FieldRenderPalette } from "./field-render-tokens";

export const FieldAnchorLayer = React.memo(function FieldAnchorLayer({
  anchors,
  options,
  metersPerPixel,
  palette,
}: {
  readonly anchors: readonly FieldAnchorGeometry[];
  readonly options: FieldAnchorOverlayOptions;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
}) {
  const rangeStrokeWidth = useDerivedValue(() => metersPerPixel.value);
  if (!options.visible) return null;

  return (
    <>
      {options.showRange && options.rangeMeters > 0
        ? anchors.map((anchor) => (
            <Group key={`range-${anchor.id}`}>
              <Circle
                cx={anchor.position.xMeters}
                cy={anchor.position.yMeters}
                r={options.rangeMeters}
                color={palette.anchorRange}
                style="fill"
              />
              <Circle
                cx={anchor.position.xMeters}
                cy={anchor.position.yMeters}
                r={options.rangeMeters}
                color={palette.anchorRange}
                style="stroke"
                strokeWidth={rangeStrokeWidth}
              />
            </Group>
          ))
        : null}
      {anchors.map((anchor) => (
        <AnchorMarker
          key={anchor.id}
          anchor={anchor}
          metersPerPixel={metersPerPixel}
          color={palette.anchor}
        />
      ))}
    </>
  );
});

function AnchorMarker({
  anchor,
  metersPerPixel,
  color,
}: {
  readonly anchor: FieldAnchorGeometry;
  readonly metersPerPixel: SharedValue<number>;
  readonly color: string;
}) {
  const transform = useDerivedValue(() => [
    { translateX: anchor.position.xMeters },
    { translateY: anchor.position.yMeters },
    { scaleX: metersPerPixel.value },
    { scaleY: -metersPerPixel.value },
  ]);
  return (
    <Group transform={transform}>
      <Path
        path="M 0 -9 L -9 8 L 9 8 Z"
        color={color}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
  );
}
