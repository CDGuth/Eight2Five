import React from "react";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { pageDialIndexForPoint } from "./page-dial-math";

function setSharedValue<T>(sharedValue: SharedValue<T>, value: T): void {
  "worklet";
  sharedValue.value = value;
}

export function triggerPageDialHaptic(): void {
  void Haptics.selectionAsync().catch(() => undefined);
}

export function usePageDialGesture({
  diameter,
  pageCount,
  provisionalIndex,
  onCommitIndex,
}: {
  readonly diameter: number;
  readonly pageCount: number;
  readonly provisionalIndex: SharedValue<number>;
  readonly onCommitIndex: (index: number) => void;
}) {
  const ringActive = useSharedValue(false);
  const gestureStartIndex = useSharedValue(0);

  const updateFromPoint = (x: number, y: number) => {
    "worklet";
    if (!ringActive.value || pageCount <= 0) return;
    const nextIndex = pageDialIndexForPoint(x, y, diameter, pageCount);
    if (nextIndex === provisionalIndex.value) return;
    setSharedValue(provisionalIndex, nextIndex);
    scheduleOnRN(triggerPageDialHaptic);
  };

  const commitIndex = React.useCallback(
    (index: number) => onCommitIndex(index),
    [onCommitIndex],
  );

  return Gesture.Pan()
    .withTestId("page-dial-ring-gesture")
    .minDistance(1)
    .onBegin((event) => {
      const center = diameter / 2;
      const radialDistance = Math.hypot(event.x - center, event.y - center);
      const touchesRing =
        radialDistance >= diameter * 0.455 && radialDistance <= diameter * 0.57;
      setSharedValue(ringActive, touchesRing && pageCount > 0);
      setSharedValue(gestureStartIndex, provisionalIndex.value);
      updateFromPoint(event.x, event.y);
    })
    .onUpdate((event) => updateFromPoint(event.x, event.y))
    .onEnd((_event, success) => {
      if (
        success &&
        ringActive.value &&
        provisionalIndex.value !== gestureStartIndex.value
      ) {
        scheduleOnRN(commitIndex, provisionalIndex.value);
      }
    })
    .onFinalize((_event, success) => {
      if (!success && ringActive.value) {
        setSharedValue(provisionalIndex, gestureStartIndex.value);
      }
      setSharedValue(ringActive, false);
    });
}
