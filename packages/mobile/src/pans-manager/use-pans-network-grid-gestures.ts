import React from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import {
  centerForStationaryWorldPoint,
  clampCameraAxis,
  panCameraCenter,
  screenPointToWorld,
  setGridCamera,
} from "./pans-network-grid-camera";
import type {
  GridPoint,
  GridSize,
  GridViewport,
} from "./pans-network-grid-math";
import type {
  PansGridCameraSharedValues,
  PansGridNode,
} from "./pans-network-grid-types";

interface UsePansNetworkGridGesturesOptions {
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  nodes: PansGridNode[];
  boundedMinX?: number;
  boundedMaxX?: number;
  boundedMinY?: number;
  boundedMaxY?: number;
  editMode: boolean;
  onViewportChange(viewport: GridViewport): void;
  onSelectNode?(nodeId: string | undefined): void;
  onLongPressCoordinate?(point: GridPoint): void;
  testID: string;
}

export function usePansNetworkGridGestures({
  camera,
  canvasSize,
  nodes,
  boundedMinX,
  boundedMaxX,
  boundedMinY,
  boundedMaxY,
  editMode,
  onViewportChange,
  onSelectNode,
  onLongPressCoordinate,
  testID,
}: UsePansNetworkGridGesturesOptions) {
  const gestureActive = useSharedValue(false);
  const panStartCenter = useSharedValue<GridPoint>({
    xMeters: camera.centerX.value,
    yMeters: camera.centerY.value,
  });
  const panStartScale = useSharedValue(camera.metersPerPixel.value);
  const pinchInitialized = useSharedValue(false);
  const pinchStartScale = useSharedValue(camera.metersPerPixel.value);
  const pinchWorldPoint = useSharedValue<GridPoint>({
    xMeters: 0,
    yMeters: 0,
  });

  const commitViewport = React.useCallback(
    (centerXMeters: number, centerYMeters: number, metersPerPixel: number) => {
      onViewportChange({ centerXMeters, centerYMeters, metersPerPixel });
    },
    [onViewportChange],
  );

  const pan = Gesture.Pan()
    .withTestId(`${testID}-pan-gesture`)
    .maxPointers(1)
    .minDistance(2)
    .onStart(() => {
      gestureActive.value = true;
      panStartCenter.value = {
        xMeters: camera.centerX.value,
        yMeters: camera.centerY.value,
      };
      panStartScale.value = camera.metersPerPixel.value;
    })
    .onUpdate((event) => {
      const nextCenter = panCameraCenter(
        panStartCenter.value,
        event.translationX,
        event.translationY,
        panStartScale.value,
      );
      setGridCamera(camera, {
        centerXMeters: clampCameraAxis(
          nextCenter.xMeters,
          boundedMinX,
          boundedMaxX,
          (canvasSize.value.width * camera.metersPerPixel.value) / 2,
        ),
        centerYMeters: clampCameraAxis(
          nextCenter.yMeters,
          boundedMinY,
          boundedMaxY,
          (canvasSize.value.height * camera.metersPerPixel.value) / 2,
        ),
        metersPerPixel: camera.metersPerPixel.value,
      });
    })
    .onEnd(() => {
      runOnJS(commitViewport)(
        camera.centerX.value,
        camera.centerY.value,
        camera.metersPerPixel.value,
      );
    })
    .onFinalize(() => {
      gestureActive.value = false;
    });

  const pinch = Gesture.Pinch()
    .withTestId(`${testID}-pinch-gesture`)
    .onStart(() => {
      gestureActive.value = true;
      pinchInitialized.value = false;
    })
    .onUpdate((event) => {
      if (event.numberOfPointers < 2) return;
      const safeScale = Math.max(event.scale, 0.000001);
      if (!pinchInitialized.value) {
        pinchStartScale.value = camera.metersPerPixel.value * safeScale;
        pinchWorldPoint.value = screenPointToWorld(
          { x: event.focalX, y: event.focalY },
          canvasSize.value,
          {
            xMeters: camera.centerX.value,
            yMeters: camera.centerY.value,
          },
          camera.metersPerPixel.value,
        );
        pinchInitialized.value = true;
      }
      const nextScale = Math.min(
        10_000,
        Math.max(0.0001, pinchStartScale.value / safeScale),
      );
      const nextCenter = centerForStationaryWorldPoint(
        pinchWorldPoint.value,
        { x: event.focalX, y: event.focalY },
        canvasSize.value,
        nextScale,
      );
      setGridCamera(camera, {
        centerXMeters: clampCameraAxis(
          nextCenter.xMeters,
          boundedMinX,
          boundedMaxX,
          (canvasSize.value.width * nextScale) / 2,
        ),
        centerYMeters: clampCameraAxis(
          nextCenter.yMeters,
          boundedMinY,
          boundedMaxY,
          (canvasSize.value.height * nextScale) / 2,
        ),
        metersPerPixel: nextScale,
      });
    })
    .onEnd(() => {
      runOnJS(commitViewport)(
        camera.centerX.value,
        camera.centerY.value,
        camera.metersPerPixel.value,
      );
    })
    .onFinalize(() => {
      pinchInitialized.value = false;
      gestureActive.value = false;
    });

  const selectOnJS = React.useCallback(
    (nodeId: string | undefined) => onSelectNode?.(nodeId),
    [onSelectNode],
  );
  const hitTargets = React.useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        xMeters: node.position.xMeters,
        yMeters: node.position.yMeters,
        livePosition: node.livePosition,
      })),
    [nodes],
  );
  const tap = Gesture.Tap()
    .withTestId(`${testID}-tap-gesture`)
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (!success) return;
      let selected: string | undefined;
      let closestDistance = 24;
      for (const target of hitTargets) {
        const position = target.livePosition?.value ?? target;
        const x =
          canvasSize.value.width / 2 +
          (position.xMeters - camera.centerX.value) /
            camera.metersPerPixel.value;
        const y =
          canvasSize.value.height / 2 -
          (position.yMeters - camera.centerY.value) /
            camera.metersPerPixel.value;
        const distance = Math.hypot(x - event.x, y - event.y);
        if (distance <= closestDistance) {
          closestDistance = distance;
          selected = target.id;
        }
      }
      runOnJS(selectOnJS)(selected);
    });

  const longPressOnJS = React.useCallback(
    (point: GridPoint) => onLongPressCoordinate?.(point),
    [onLongPressCoordinate],
  );
  const longPress = Gesture.LongPress()
    .withTestId(`${testID}-long-press-gesture`)
    .enabled(editMode && Boolean(onLongPressCoordinate))
    .minDuration(550)
    .maxDistance(12)
    .onStart((event) => {
      runOnJS(longPressOnJS)(
        screenPointToWorld(
          { x: event.x, y: event.y },
          canvasSize.value,
          {
            xMeters: camera.centerX.value,
            yMeters: camera.centerY.value,
          },
          camera.metersPerPixel.value,
        ),
      );
    });

  return {
    gesture: Gesture.Race(
      Gesture.Simultaneous(pan, pinch),
      Gesture.Exclusive(longPress, tap),
    ),
    gestureActive,
  };
}
