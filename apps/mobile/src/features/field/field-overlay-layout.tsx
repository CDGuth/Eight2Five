import React from "react";
import { View, type ViewStyle } from "react-native";
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";

export interface FieldOverlayMetrics {
  readonly outerPadding: number;
  readonly hudStyle: ViewStyle;
  readonly dialStyle: ViewStyle;
  readonly dialDiameter: number;
}

export function getFieldOverlayMetrics({
  width,
  height,
  landscape,
  insets,
}: {
  readonly width: number;
  readonly height: number;
  readonly landscape: boolean;
  readonly insets: EdgeInsets;
}): FieldOverlayMetrics {
  const outerPadding = landscape ? 16 : 12;
  const availableWidth = Math.max(0, width - insets.left - insets.right);
  const dialDiameter = landscape
    ? Math.min(172, Math.max(148, height * 0.42))
    : Math.min(156, Math.max(140, width * 0.38));

  if (landscape) {
    const right = insets.right + outerPadding;
    return {
      outerPadding,
      dialDiameter,
      hudStyle: {
        position: "absolute",
        top: insets.top + outerPadding,
        left: insets.left + outerPadding,
        width: Math.min(availableWidth * 0.72, 720),
        maxHeight: 136,
      },
      dialStyle: {
        position: "absolute",
        right,
        top: Math.max(
          insets.top + outerPadding,
          (height - dialDiameter + insets.top - insets.bottom) / 2,
        ),
        width: dialDiameter,
        height: dialDiameter,
      },
    };
  }

  return {
    outerPadding,
    dialDiameter,
    hudStyle: {
      position: "absolute",
      top: insets.top + outerPadding,
      left: insets.left + outerPadding,
      right: insets.right + outerPadding,
      maxHeight: 196,
    },
    dialStyle: {
      position: "absolute",
      alignSelf: "center",
      left:
        insets.left + (width - insets.left - insets.right - dialDiameter) / 2,
      bottom: insets.bottom + outerPadding,
      width: dialDiameter,
      height: dialDiameter,
    },
  };
}

interface FieldOverlayLayoutProps {
  readonly width: number;
  readonly height: number;
  readonly landscape: boolean;
  readonly field: React.ReactNode;
  readonly hud?: React.ReactNode;
  readonly dial?: (diameter: number) => React.ReactNode;
}

export function FieldOverlayLayout({
  width,
  height,
  landscape,
  field,
  hud,
  dial,
}: FieldOverlayLayoutProps) {
  const insets = useSafeAreaInsets();
  const metrics = getFieldOverlayMetrics({ width, height, landscape, insets });

  return (
    <View
      style={{ flex: 1 }}
      testID={`field-layout-${landscape ? "landscape" : "portrait"}`}
    >
      <View style={{ flex: 1 }}>{field}</View>
      {hud ? (
        <View
          pointerEvents="box-none"
          style={metrics.hudStyle}
          testID="field-hud-slot"
        >
          {hud}
        </View>
      ) : null}
      {dial ? (
        <View
          pointerEvents="box-none"
          style={metrics.dialStyle}
          testID="field-dial-slot"
        >
          {dial(metrics.dialDiameter)}
        </View>
      ) : null}
    </View>
  );
}
