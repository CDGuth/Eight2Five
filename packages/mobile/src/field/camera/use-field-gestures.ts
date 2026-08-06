import React from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { FieldPoint } from "../types";
import {
  clampFieldCameraAxis,
  createFieldPanBaseline,
  fieldCenterForStationaryWorldPoint,
  fieldPanCenter,
  fieldScreenToWorld,
  setFieldCamera,
} from "./field-camera-math";
import {
  FIELD_MIN_METERS_PER_PIXEL,
  getFieldMaximumMetersPerPixel,
} from "./field-camera-policy";
import type {
  FieldCamera,
  FieldCameraBounds,
  FieldCameraPerspective,
  FieldPanBaseline,
  FieldViewport,
  FieldViewportSize,
} from "./field-camera-types";

interface UseFieldGesturesOptions {
  readonly camera: FieldCamera;
  readonly canvasSize: SharedValue<FieldViewportSize>;
  readonly cameraBounds: FieldCameraBounds;
  readonly gridBounds: FieldCameraBounds;
  readonly perspective?: FieldCameraPerspective;
  readonly onViewportChange?: (viewport: FieldViewport) => void;
  readonly testID?: string;
}

function setSharedValue<T>(sharedValue: SharedValue<T>, value: T): void {
  "worklet";
  sharedValue.value = value;
}

export function useFieldGestures({
  camera,
  canvasSize,
  cameraBounds,
  gridBounds,
  perspective = "director",
  onViewportChange,
  testID = "field",
}: UseFieldGesturesOptions) {
  const panActive = useSharedValue(false);
  const pinchActive = useSharedValue(false);
  const panNeedsRebase = useSharedValue(true);
  const panBaseline = useSharedValue<FieldPanBaseline>(
    createFieldPanBaseline({ xMeters: 0, yMeters: 0 }, 0, 0, 1),
  );
  const pinchInitialized = useSharedValue(false);
  const pinchStartScale = useSharedValue(1);
  const pinchWorldPoint = useSharedValue<FieldPoint>({
    xMeters: 0,
    yMeters: 0,
  });
  const interactionActive = useDerivedValue(
    () => panActive.value || pinchActive.value,
  );

  const commitViewport = React.useCallback(
    (centerXMeters: number, centerYMeters: number, metersPerPixel: number) => {
      onViewportChange?.({ centerXMeters, centerYMeters, metersPerPixel });
    },
    [onViewportChange],
  );

  const scheduleCommit = () => {
    "worklet";
    scheduleOnRN(
      commitViewport,
      camera.centerXMeters.value,
      camera.centerYMeters.value,
      camera.metersPerPixel.value,
    );
  };

  const pan = Gesture.Pan()
    .withTestId(`${testID}-pan-gesture`)
    .minDistance(2)
    .onStart((event) => {
      setSharedValue(panActive, true);
      setSharedValue(panNeedsRebase, false);
      setSharedValue(
        panBaseline,
        createFieldPanBaseline(
          {
            xMeters: camera.centerXMeters.value,
            yMeters: camera.centerYMeters.value,
          },
          event.translationX,
          event.translationY,
          camera.metersPerPixel.value,
        ),
      );
    })
    .onUpdate((event) => {
      if (event.numberOfPointers !== 1 || pinchActive.value) {
        setSharedValue(panNeedsRebase, true);
        return;
      }
      if (panNeedsRebase.value) {
        setSharedValue(
          panBaseline,
          createFieldPanBaseline(
            {
              xMeters: camera.centerXMeters.value,
              yMeters: camera.centerYMeters.value,
            },
            event.translationX,
            event.translationY,
            camera.metersPerPixel.value,
          ),
        );
        setSharedValue(panNeedsRebase, false);
        return;
      }
      const next = fieldPanCenter(
        panBaseline.value,
        event.translationX,
        event.translationY,
        perspective,
      );
      const halfWidth =
        (canvasSize.value.width * camera.metersPerPixel.value) / 2;
      const halfHeight =
        (canvasSize.value.height * camera.metersPerPixel.value) / 2;
      setFieldCamera(camera, {
        centerXMeters: clampFieldCameraAxis(
          next.xMeters,
          cameraBounds.minXMeters,
          cameraBounds.maxXMeters,
          halfWidth,
        ),
        centerYMeters: clampFieldCameraAxis(
          next.yMeters,
          cameraBounds.minYMeters,
          cameraBounds.maxYMeters,
          halfHeight,
        ),
        metersPerPixel: camera.metersPerPixel.value,
      });
    })
    .onEnd(() => {
      if (!pinchActive.value) scheduleCommit();
    })
    .onFinalize(() => {
      setSharedValue(panActive, false);
      setSharedValue(panNeedsRebase, true);
    });

  const pinch = Gesture.Pinch()
    .withTestId(`${testID}-pinch-gesture`)
    .onStart(() => {
      setSharedValue(pinchActive, true);
      setSharedValue(pinchInitialized, false);
      setSharedValue(panNeedsRebase, true);
    })
    .onUpdate((event) => {
      if (event.numberOfPointers < 2) return;
      const safeScale = Math.max(event.scale, 0.000001);
      if (!pinchInitialized.value) {
        setSharedValue(
          pinchStartScale,
          camera.metersPerPixel.value * safeScale,
        );
        setSharedValue(
          pinchWorldPoint,
          fieldScreenToWorld(
            { x: event.focalX, y: event.focalY },
            {
              centerXMeters: camera.centerXMeters.value,
              centerYMeters: camera.centerYMeters.value,
              metersPerPixel: camera.metersPerPixel.value,
            },
            canvasSize.value,
            perspective,
          ),
        );
        setSharedValue(pinchInitialized, true);
      }
      const maximumMetersPerPixel = getFieldMaximumMetersPerPixel(
        canvasSize.value,
        gridBounds,
      );
      const nextScale = Math.min(
        maximumMetersPerPixel,
        Math.max(FIELD_MIN_METERS_PER_PIXEL, pinchStartScale.value / safeScale),
      );
      const next = fieldCenterForStationaryWorldPoint(
        pinchWorldPoint.value,
        { x: event.focalX, y: event.focalY },
        canvasSize.value,
        nextScale,
        perspective,
      );
      setFieldCamera(camera, {
        centerXMeters: clampFieldCameraAxis(
          next.xMeters,
          cameraBounds.minXMeters,
          cameraBounds.maxXMeters,
          (canvasSize.value.width * nextScale) / 2,
        ),
        centerYMeters: clampFieldCameraAxis(
          next.yMeters,
          cameraBounds.minYMeters,
          cameraBounds.maxYMeters,
          (canvasSize.value.height * nextScale) / 2,
        ),
        metersPerPixel: nextScale,
      });
    })
    .onEnd(scheduleCommit)
    .onFinalize(() => {
      setSharedValue(pinchInitialized, false);
      setSharedValue(pinchActive, false);
      setSharedValue(panNeedsRebase, true);
    });

  return {
    gesture: Gesture.Simultaneous(pan, pinch),
    interactionActive,
  } as const;
}
