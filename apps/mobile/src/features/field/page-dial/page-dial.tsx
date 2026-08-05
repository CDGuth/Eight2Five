import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { DrillTerminology } from "@eight2five/mobile/drill";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import { PageDialCanvas } from "./page-dial-canvas";
import { PageDialControls } from "./page-dial-controls";
import { triggerPageDialHaptic, usePageDialGesture } from "./page-dial-gesture";
import { normalizePageIndex } from "./page-dial-math";

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
  dividerColor,
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
  readonly dividerColor?: string;
  readonly onSelectIndex: (index: number) => void;
  readonly onSelectDrill?: () => void;
  readonly onSelectPerformer?: () => void;
}) {
  const theme = useEight2FiveTheme();
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

  const resolvedInnerColor = innerColor ?? theme.surfaceRaised;
  const resolvedBackgroundColor = backgroundColor ?? theme.background;
  const resolvedForegroundColor = foregroundColor ?? theme.text;
  const resolvedDividerColor = dividerColor ?? theme.border;

  return (
    <View
      style={{ width: diameter, height: diameter, overflow: "visible" }}
      testID="page-dial"
    >
      <PageDialCanvas
        diameter={diameter}
        pageCount={pageCount}
        provisionalProgress={provisionalProgress}
        activeColor={activeColor}
        trackColor={trackColor}
        innerColor={resolvedInnerColor}
        backgroundColor={resolvedBackgroundColor}
        foregroundColor={resolvedForegroundColor}
        dividerColor={resolvedDividerColor}
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
