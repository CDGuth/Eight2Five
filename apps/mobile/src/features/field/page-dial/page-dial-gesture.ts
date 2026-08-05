import React from "react";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
  normalizePageIndex,
  pageDialIndexForProgress,
  pageDialPointIsInControlHitTarget,
  pageDialProgressForPoint,
  pageDialPointIsInRingHitRegion,
} from "./page-dial-math";

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
  selectedIndex = 0,
  provisionalProgress,
  onCommitIndex,
}: {
  readonly diameter: number;
  readonly pageCount: number;
  readonly selectedIndex?: number;
  readonly provisionalProgress: SharedValue<number>;
  readonly onCommitIndex: (index: number) => void;
}) {
  const ringActive = useSharedValue(false);
  const gestureStartProgress = useSharedValue(0);
  const gestureStartIndex = useSharedValue(0);
  const previewIndex = useSharedValue(0);

  const updateFromPoint = (x: number, y: number, shouldHaptic = true) => {
    "worklet";
    if (!ringActive.value || pageCount <= 0) return;
    const nextProgress = pageDialProgressForPoint(x, y, diameter);
    const nextIndex = pageDialIndexForProgress(nextProgress, pageCount);
    setSharedValue(provisionalProgress, nextProgress);
    if (nextIndex === previewIndex.value) return;
    setSharedValue(previewIndex, nextIndex);
    if (shouldHaptic) scheduleOnRN(triggerPageDialHaptic);
  };

  const commitIndex = React.useCallback(
    (index: number) => onCommitIndex(index),
    [onCommitIndex],
  );

  const settleProgress = (index: number) => {
    "worklet";
    const targetProgress = normalizePageIndex(index, pageCount);
    const shouldCommit = index !== gestureStartIndex.value;
    setSharedValue(
      provisionalProgress,
      withSpring(
        targetProgress,
        {
          damping: 18,
          stiffness: 210,
          mass: 0.7,
        },
        (finished) => {
          "worklet";
          if (finished && shouldCommit) {
            scheduleOnRN(commitIndex, index);
          }
        },
      ),
    );
  };

  return Gesture.Pan()
    .withTestId("page-dial-ring-gesture")
    .manualActivation(true)
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      if (
        touch &&
        pageCount > 0 &&
        pageDialPointIsInRingHitRegion(touch.x, touch.y, diameter) &&
        !pageDialPointIsInControlHitTarget(touch.x, touch.y, diameter)
      ) {
        manager.activate();
      } else {
        manager.fail();
      }
    })
    .minDistance(1)
    .onBegin((event) => {
      const touchesRing =
        pageDialPointIsInRingHitRegion(event.x, event.y, diameter) &&
        !pageDialPointIsInControlHitTarget(event.x, event.y, diameter);
      setSharedValue(ringActive, touchesRing && pageCount > 0);
      if (!touchesRing || pageCount <= 0) return;
      cancelAnimation(provisionalProgress);
      setSharedValue(gestureStartProgress, provisionalProgress.value);
      setSharedValue(
        gestureStartIndex,
        selectedIndex >= 0 ? selectedIndex : -1,
      );
      setSharedValue(previewIndex, gestureStartIndex.value);
      updateFromPoint(event.x, event.y, false);
    })
    .onUpdate((event) => updateFromPoint(event.x, event.y))
    .onEnd((_event, success) => {
      if (!success || !ringActive.value || pageCount <= 0) return;
      const snappedIndex = pageDialIndexForProgress(
        provisionalProgress.value,
        pageCount,
      );
      settleProgress(snappedIndex);
    })
    .onFinalize((_event, success) => {
      if (!success && ringActive.value) {
        cancelAnimation(provisionalProgress);
        setSharedValue(
          provisionalProgress,
          withTiming(gestureStartProgress.value, { duration: 140 }),
        );
      }
      setSharedValue(ringActive, false);
    });
}
