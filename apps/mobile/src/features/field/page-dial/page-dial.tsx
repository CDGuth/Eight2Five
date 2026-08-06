import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { DrillTerminology } from "@eight2five/mobile/drill";
import {
  useEight2FiveTheme,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

import { FrostedFieldSurface } from "../field-frosted-surface";

import { PageDialCanvas } from "./page-dial-canvas";
import { PageDialControls, PageDialDividers } from "./page-dial-controls";
import { triggerPageDialHaptic, usePageDialGesture } from "./page-dial-gesture";
import {
  normalizePageIndex,
  PAGE_DIAL_KNOB_DIAMETER_RATIO,
  pageDialPointForProgress,
} from "./page-dial-math";

function animateProgress(
  sharedValue: SharedValue<number>,
  progress: number,
): void {
  sharedValue.value = withTiming(progress, { duration: 180 });
}

export function PageDial({
  diameter,
  selectedIndex,
  selectedLabel,
  pageCount,
  terminology,
  activeColor,
  trackColor,
  innerColor,
  backgroundColor,
  foregroundColor,
  onSelectIndex,
  onSelectDrill,
  onSelectPerformer,
}: {
  readonly diameter: number;
  readonly selectedIndex: number;
  readonly selectedLabel?: string;
  readonly pageCount: number;
  readonly terminology: DrillTerminology;
  readonly activeColor: string;
  readonly trackColor: string;
  readonly innerColor?: string;
  readonly backgroundColor?: string;
  readonly foregroundColor?: string;
  readonly onSelectIndex: (index: number) => void;
  readonly onSelectDrill?: () => void;
  readonly onSelectPerformer?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const themeName = useEight2FiveThemeName();
  const provisionalProgress = useSharedValue(
    normalizePageIndex(Math.max(0, selectedIndex), pageCount),
  );
  React.useEffect(() => {
    animateProgress(
      provisionalProgress,
      normalizePageIndex(Math.max(0, selectedIndex), pageCount),
    );
  }, [pageCount, provisionalProgress, selectedIndex]);

  const gesture = usePageDialGesture({
    diameter,
    pageCount,
    selectedIndex,
    provisionalProgress,
    onCommitIndex: onSelectIndex,
  });
  const selectFromButton = React.useCallback(
    (index: number) => {
      if (pageCount <= 0) return;
      const bounded = Math.max(0, Math.min(pageCount - 1, index));
      if (bounded === selectedIndex) return;
      animateProgress(
        provisionalProgress,
        normalizePageIndex(bounded, pageCount),
      );
      triggerPageDialHaptic();
      onSelectIndex(bounded);
    },
    [onSelectIndex, pageCount, provisionalProgress, selectedIndex],
  );

  const resolvedInnerColor =
    innerColor ?? colorWithOpacity(theme.surfaceRaised, 0.38);
  const resolvedBackgroundColor = backgroundColor ?? "transparent";
  const resolvedForegroundColor = foregroundColor ?? theme.text;

  return (
    <View
      style={{ width: diameter, height: diameter, overflow: "visible" }}
      testID="page-dial"
    >
      <FrostedFieldSurface
        key={`page-dial-surface-${themeName}`}
        borderRadius={diameter / 2}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: diameter,
          height: diameter,
        }}
      >
        <View style={{ flex: 1 }} pointerEvents="none" />
      </FrostedFieldSurface>
      <PageDialCanvas
        key={`page-dial-canvas-${themeName}`}
        diameter={diameter}
        pageCount={pageCount}
        provisionalProgress={provisionalProgress}
        activeColor={activeColor}
        trackColor={trackColor}
        innerColor={resolvedInnerColor}
        backgroundColor={resolvedBackgroundColor}
        knobColor={theme.raw.white}
      />
      <PageDialDividers diameter={diameter} />
      <PageDialKnob
        diameter={diameter}
        progress={provisionalProgress}
        color={theme.raw.white}
      />
      <GestureDetector gesture={gesture}>
        <View
          accessibilityElementsHidden
          collapsable={false}
          importantForAccessibility="no"
          pointerEvents="box-only"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
          testID="page-dial-ring-hit-area"
        />
      </GestureDetector>
      <PageDialControls
        diameter={diameter}
        selectedIndex={selectedIndex}
        selectedLabel={selectedLabel}
        pageCount={pageCount}
        terminology={terminology}
        foregroundColor={resolvedForegroundColor}
        onPrevious={() => selectFromButton(selectedIndex - 1)}
        onNext={() =>
          selectFromButton(selectedIndex < 0 ? 0 : selectedIndex + 1)
        }
        onSelectDrill={onSelectDrill}
        onSelectPerformer={onSelectPerformer}
      />
    </View>
  );
}

function PageDialKnob({
  diameter,
  progress,
  color,
}: {
  readonly diameter: number;
  readonly progress: SharedValue<number>;
  readonly color: string;
}) {
  const knobDiameter = diameter * PAGE_DIAL_KNOB_DIAMETER_RATIO;
  const animatedStyle = useAnimatedStyle(() => {
    const point = pageDialPointForProgress(progress.value, diameter);
    return {
      left: point.x - knobDiameter / 2,
      top: point.y - knobDiameter / 2,
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: knobDiameter,
          height: knobDiameter,
          borderRadius: knobDiameter / 2,
          backgroundColor: color,
          boxShadow: `0 ${diameter * 0.018}px ${
            diameter * 0.03
          }px rgba(0,0,0,0.22)`,
        },
        animatedStyle,
      ]}
      testID="page-dial-knob"
    />
  );
}

function colorWithOpacity(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
