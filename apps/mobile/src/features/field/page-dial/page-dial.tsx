import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { DrillTerminology } from "@eight2five/mobile/drill";

import { PageDialCanvas } from "./page-dial-canvas";
import { PageDialControls } from "./page-dial-controls";
import { triggerPageDialHaptic, usePageDialGesture } from "./page-dial-gesture";

function animateIndex(sharedValue: SharedValue<number>, index: number): void {
  sharedValue.value = withTiming(index, { duration: 120 });
}

export function PageDial({
  diameter,
  selectedIndex,
  selectedLabel,
  pageCount,
  terminology,
  activeColor,
  trackColor,
  onSelectIndex,
}: {
  readonly diameter: number;
  readonly selectedIndex: number;
  readonly selectedLabel?: string;
  readonly pageCount: number;
  readonly terminology: DrillTerminology;
  readonly activeColor: string;
  readonly trackColor: string;
  readonly onSelectIndex: (index: number) => void;
}) {
  const provisionalIndex = useSharedValue(Math.max(0, selectedIndex));
  React.useEffect(() => {
    animateIndex(provisionalIndex, Math.max(0, selectedIndex));
  }, [provisionalIndex, selectedIndex]);

  const gesture = usePageDialGesture({
    diameter,
    pageCount,
    provisionalIndex,
    onCommitIndex: onSelectIndex,
  });
  const selectFromButton = React.useCallback(
    (index: number) => {
      const bounded = Math.max(0, Math.min(pageCount - 1, index));
      if (bounded === selectedIndex) return;
      animateIndex(provisionalIndex, bounded);
      triggerPageDialHaptic();
      onSelectIndex(bounded);
    },
    [onSelectIndex, pageCount, provisionalIndex, selectedIndex],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: diameter, height: diameter }} testID="page-dial">
        <PageDialCanvas
          diameter={diameter}
          pageCount={pageCount}
          provisionalIndex={provisionalIndex}
          activeColor={activeColor}
          trackColor={trackColor}
        />
        <PageDialControls
          diameter={diameter}
          selectedIndex={selectedIndex}
          selectedLabel={selectedLabel}
          pageCount={pageCount}
          terminology={terminology}
          onPrevious={() => selectFromButton(selectedIndex - 1)}
          onNext={() =>
            selectFromButton(selectedIndex < 0 ? 0 : selectedIndex + 1)
          }
        />
      </View>
    </GestureDetector>
  );
}
