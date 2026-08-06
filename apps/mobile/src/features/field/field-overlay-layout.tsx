import React from "react";
import { BlurTargetView } from "expo-blur";
import { View, type ViewStyle } from "react-native";

import { FieldBlurTargetContext } from "./field-frosted-surface";
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";

export interface FieldOverlayMetrics {
  readonly outerPadding: number;
  readonly controlGap: number;
  readonly controlDiameter: number;
  /** @deprecated Use controlDiameter. */
  readonly dialDiameter: number;
  readonly hudWidth: number;
  readonly hudListMaxHeight: number;
  readonly hudStyle: ViewStyle;
  readonly liveStyle: ViewStyle;
  readonly dialStyle: ViewStyle;
}

export function getFieldOverlayMetrics({
  width,
  height,
  landscape,
  insets,
  controlPairVisible = true,
}: {
  readonly width: number;
  readonly height: number;
  readonly landscape: boolean;
  readonly insets: EdgeInsets;
  readonly controlPairVisible?: boolean;
}): FieldOverlayMetrics {
  const outerPadding = landscape ? 14 : 12;
  const safeWidth = Math.max(0, width - insets.left - insets.right);
  const safeHeight = Math.max(0, height - insets.top - insets.bottom);

  if (landscape) {
    const landscapeEdgePadding = 8;
    const maximumFittingDiameter = Math.max(
      0,
      (safeHeight - outerPadding * 3) / 2,
    );
    const controlDiameter = Math.min(164, maximumFittingDiameter);
    const controlGap = Math.max(0, (safeHeight - controlDiameter * 2) / 3);
    const stackTop = insets.top + controlGap;
    // NativeTabs are hidden on the landscape Field route. Keep the controls
    // close to the physical screen edge instead of stacking the full safe-area
    // inset and normal HUD padding, which leaves an oversized dead strip.
    const right = Math.max(
      landscapeEdgePadding,
      Math.min(insets.right, outerPadding),
    );
    const columnLeft = width - right - controlDiameter;
    const hudLeft = insets.left + outerPadding;
    const hudWidth = controlPairVisible
      ? Math.max(0, Math.min(720, columnLeft - controlGap - hudLeft))
      : Math.max(0, safeWidth - outerPadding * 2);
    const hudTop = insets.top + outerPadding;
    return {
      outerPadding,
      controlGap,
      controlDiameter,
      dialDiameter: controlDiameter,
      hudWidth,
      hudListMaxHeight: Math.min(
        320,
        Math.max(0, height - insets.bottom - outerPadding - hudTop - 82),
      ),
      hudStyle: {
        position: "absolute",
        top: hudTop,
        left: hudLeft,
        width: hudWidth,
      },
      liveStyle: {
        position: "absolute",
        right,
        top: stackTop,
        width: controlDiameter,
        height: controlDiameter,
      },
      dialStyle: {
        position: "absolute",
        right,
        top: stackTop + controlDiameter + controlGap,
        width: controlDiameter,
        height: controlDiameter,
      },
    };
  }

  const maximumFittingDiameter = Math.max(
    0,
    (safeWidth - outerPadding * 3) / 2,
  );
  const controlDiameter = Math.min(156, maximumFittingDiameter);
  const controlGap = Math.max(0, (safeWidth - controlDiameter * 2) / 3);
  const pairLeft = insets.left + controlGap;
  const controlsBottom = insets.bottom + controlGap;
  const controlsTop = height - controlsBottom - controlDiameter;
  const hudLeft = insets.left + outerPadding;
  const hudWidth = Math.max(0, safeWidth - outerPadding * 2);
  const hudTop = insets.top + outerPadding;
  return {
    outerPadding,
    controlGap,
    controlDiameter,
    dialDiameter: controlDiameter,
    hudWidth,
    hudListMaxHeight: Math.min(
      360,
      Math.max(0, controlsTop - controlGap - hudTop - 82),
    ),
    hudStyle: {
      position: "absolute",
      top: hudTop,
      left: hudLeft,
      width: hudWidth,
    },
    liveStyle: {
      position: "absolute",
      left: pairLeft,
      bottom: controlsBottom,
      width: controlDiameter,
      height: controlDiameter,
    },
    dialStyle: {
      position: "absolute",
      left: pairLeft + controlDiameter + controlGap,
      bottom: controlsBottom,
      width: controlDiameter,
      height: controlDiameter,
    },
  };
}

interface FieldOverlayLayoutProps {
  readonly width: number;
  readonly height: number;
  readonly landscape: boolean;
  readonly controlPairVisible?: boolean;
  readonly field: React.ReactNode;
  readonly hud?: (metrics: FieldOverlayMetrics) => React.ReactNode;
  readonly live?: (diameter: number) => React.ReactNode;
  readonly dial?: (diameter: number) => React.ReactNode;
}

export function FieldOverlayLayout({
  width,
  height,
  landscape,
  controlPairVisible = true,
  field,
  hud,
  live,
  dial,
}: FieldOverlayLayoutProps) {
  const insets = useSafeAreaInsets();
  const blurTargetRef = React.useRef<View | null>(null);
  const metrics = getFieldOverlayMetrics({
    width,
    height,
    landscape,
    insets,
    controlPairVisible,
  });

  return (
    <FieldBlurTargetContext.Provider value={blurTargetRef}>
      <View
        style={{ flex: 1 }}
        testID={`field-layout-${landscape ? "landscape" : "portrait"}`}
      >
        <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
          {field}
        </BlurTargetView>
        {hud ? (
          <View
            pointerEvents="box-none"
            style={metrics.hudStyle}
            testID="field-hud-slot"
          >
            {hud(metrics)}
          </View>
        ) : null}
        {live ? (
          <View
            pointerEvents="box-none"
            style={metrics.liveStyle}
            testID="field-live-slot"
          >
            {live(metrics.controlDiameter)}
          </View>
        ) : null}
        {dial ? (
          <View
            pointerEvents="box-none"
            style={metrics.dialStyle}
            testID="field-dial-slot"
          >
            {dial(metrics.controlDiameter)}
          </View>
        ) : null}
      </View>
    </FieldBlurTargetContext.Provider>
  );
}
