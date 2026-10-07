import React from "react";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Group, Text, useFont, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type {
  FieldCamera,
  FieldCameraPerspective,
  FieldViewportSize,
} from "../camera/field-camera-types";
import type {
  FieldYardNumber,
  StandardFootballFieldTemplate,
} from "../template";
import {
  FIELD_NUMBER_OPACITY,
  STICKY_YARD_NUMBER_BOTTOM_INSET_PX,
  STICKY_YARD_NUMBER_MAX_HEIGHT_PX,
  STICKY_YARD_NUMBER_MIN_HEIGHT_PX,
  type FieldRenderPalette,
} from "./field-render-tokens";

const YARD_NUMBER_MEASUREMENT_FONT_SIZE = 100;

interface FieldStickyYardNumberLayerProps {
  readonly camera: FieldCamera;
  readonly canvasSize: SharedValue<FieldViewportSize>;
  readonly template: StandardFootballFieldTemplate;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
  readonly showFiveYardNumbers: boolean;
  readonly visible: boolean;
}

/**
 * Draws a screen-space copy of the lower yard-number row only after the real
 * row has moved below its sticky lane. X remains tied to the field camera so
 * every sticky number stays directly in line with its yard line.
 */
export function FieldStickyYardNumberLayer({
  camera,
  canvasSize,
  template,
  palette,
  perspective,
  showFiveYardNumbers,
  visible,
}: FieldStickyYardNumberLayerProps) {
  const font = useFont(
    Montserrat_600SemiBold,
    YARD_NUMBER_MEASUREMENT_FONT_SIZE,
  );
  if (!font || !visible) return null;

  const lowerSide = perspective === "director" ? "front" : "back";
  const numbers = (
    showFiveYardNumbers ? template.fiveYardNumbers : template.yardNumbers
  ).filter((number) => number.side === lowerSide);

  return (
    <>
      {numbers.map((number) => (
        <StickyYardNumber
          key={`sticky-${number.xMeters}`}
          number={number}
          font={font}
          camera={camera}
          canvasSize={canvasSize}
          perspective={perspective}
          color={palette.fieldNumbers}
        />
      ))}
    </>
  );
}

function StickyYardNumber({
  number,
  font,
  camera,
  canvasSize,
  perspective,
  color,
}: {
  readonly number: FieldYardNumber;
  readonly font: SkFont;
  readonly camera: FieldCamera;
  readonly canvasSize: SharedValue<FieldViewportSize>;
  readonly perspective: FieldCameraPerspective;
  readonly color: string;
}) {
  const bounds = font.measureText(number.label);
  const x = -bounds.x - bounds.width / 2;
  const y = -bounds.y - bounds.height / 2;

  const opacity = useDerivedValue(() => {
    const size = canvasSize.value;
    const metersPerPixel = camera.metersPerPixel.value;
    if (size.width <= 0 || size.height <= 0 || metersPerPixel <= 0) return 0;

    const ySign = perspective === "performer" ? 1 : -1;
    const fieldCenterY =
      size.height / 2 +
      ((number.yMeters - camera.centerYMeters.value) / metersPerPixel) * ySign;
    const desiredHeight = clamp(
      number.heightMeters / metersPerPixel,
      STICKY_YARD_NUMBER_MIN_HEIGHT_PX,
      STICKY_YARD_NUMBER_MAX_HEIGHT_PX,
    );
    const stickyCenterY =
      size.height - STICKY_YARD_NUMBER_BOTTOM_INSET_PX - desiredHeight / 2;
    return fieldCenterY > stickyCenterY ? FIELD_NUMBER_OPACITY : 0;
  });

  const transform = useDerivedValue(() => {
    const size = canvasSize.value;
    const metersPerPixel = Math.max(camera.metersPerPixel.value, 0.0001);
    const xSign = perspective === "performer" ? -1 : 1;
    const screenX =
      size.width / 2 +
      ((number.xMeters - camera.centerXMeters.value) / metersPerPixel) * xSign;
    const desiredHeight = clamp(
      number.heightMeters / metersPerPixel,
      STICKY_YARD_NUMBER_MIN_HEIGHT_PX,
      STICKY_YARD_NUMBER_MAX_HEIGHT_PX,
    );
    const scale = desiredHeight / bounds.height;
    const screenY =
      size.height - STICKY_YARD_NUMBER_BOTTOM_INSET_PX - desiredHeight / 2;
    return [
      { translateX: screenX },
      { translateY: screenY },
      { scaleX: scale },
      { scaleY: scale },
    ];
  });

  return (
    <Group transform={transform} opacity={opacity}>
      <Text x={x} y={y} text={number.label} font={font} color={color} />
    </Group>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}
