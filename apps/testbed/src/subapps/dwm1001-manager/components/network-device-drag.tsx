import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Portal } from "@eight2five/ui/components/portal";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

export const NETWORK_DEVICE_DRAG_LONG_PRESS_MS = 450;

export interface NetworkDeviceDragEvent {
  deviceKey: string;
  x: number;
  y: number;
  sourceLeft?: number;
  sourceTop?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  cancelled?: boolean;
}

export interface NetworkDeviceDragBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function createNetworkDeviceDragEvent(
  deviceKey: string,
  absoluteY: number,
  bounds: NetworkDeviceDragBounds,
  cancelled?: boolean,
): NetworkDeviceDragEvent {
  return {
    deviceKey,
    x: bounds.left + bounds.width / 2,
    y: absoluteY,
    sourceLeft: bounds.left,
    sourceTop: bounds.top,
    sourceWidth: bounds.width,
    sourceHeight: bounds.height,
    ...(cancelled !== undefined ? { cancelled } : {}),
  };
}

export interface NetworkDeviceDragProps {
  deviceKey: string;
  displayName: string;
  identifier: string;
  children: React.ReactNode;
  onDragStart(event: NetworkDeviceDragEvent): void;
  onDragMove(event: NetworkDeviceDragEvent): void;
  onDragEnd(event: NetworkDeviceDragEvent): boolean;
}

/** A long-press-only gesture wrapper for the expandable part of a device row. */
export function NetworkDeviceDrag({
  deviceKey,
  displayName,
  identifier,
  children,
  onDragStart,
  onDragMove,
  onDragEnd,
}: NetworkDeviceDragProps) {
  const theme = useEight2FiveTheme();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const previewWidth = useSharedValue(0);
  const previewHeight = useSharedValue(0);
  const sourceCenterY = useSharedValue(0);
  const previewOpacity = useSharedValue(0);
  const active = useSharedValue(0);
  const sourceRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const dragSessionRef = React.useRef(0);
  const dragStartedRef = React.useRef(false);
  const finalizedBeforeStartRef = React.useRef(false);
  const latestAbsoluteYRef = React.useRef<number | undefined>(undefined);
  const sourceBoundsRef = React.useRef({
    left: 0,
    top: 0,
    width: 180,
    height: 64,
  });
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const detailsRef = React.useRef({ deviceKey, displayName, identifier });
  const callbacksRef = React.useRef({ onDragStart, onDragMove, onDragEnd });
  React.useEffect(() => {
    detailsRef.current = { deviceKey, displayName, identifier };
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd };
  }, [deviceKey, displayName, identifier, onDragEnd, onDragMove, onDragStart]);

  /* Shared values are intentionally mutated from stable JS callbacks after
   * measuring the source row and when animating an invalid drop home. */
  /* eslint-disable react-hooks/immutability */
  const notifyStart = React.useCallback(
    (_absoluteX: number, absoluteY: number) => {
      const session = ++dragSessionRef.current;
      dragStartedRef.current = false;
      finalizedBeforeStartRef.current = false;
      latestAbsoluteYRef.current = absoluteY;
      const start = (
        left: number,
        top: number,
        width: number,
        height: number,
      ) => {
        if (
          dragSessionRef.current !== session ||
          finalizedBeforeStartRef.current
        )
          return;
        const bounds = {
          left: Number.isFinite(left) ? left : 0,
          top: Number.isFinite(top) ? top : absoluteY - 32,
          width: Number.isFinite(width) && width > 0 ? width : 180,
          height: Number.isFinite(height) && height > 0 ? height : 64,
        };
        const currentY = latestAbsoluteYRef.current ?? absoluteY;
        sourceBoundsRef.current = bounds;
        x.value = bounds.left;
        y.value = currentY;
        previewWidth.value = bounds.width;
        previewHeight.value = bounds.height;
        sourceCenterY.value = bounds.top + bounds.height / 2;
        previewOpacity.value = 1;
        dragStartedRef.current = true;
        setPreviewVisible(true);
        callbacksRef.current.onDragStart(
          createNetworkDeviceDragEvent(
            detailsRef.current.deviceKey,
            currentY,
            bounds,
          ),
        );
        if (currentY !== absoluteY) {
          callbacksRef.current.onDragMove(
            createNetworkDeviceDragEvent(
              detailsRef.current.deviceKey,
              currentY,
              bounds,
            ),
          );
        }
      };
      if (typeof sourceRef.current?.measureInWindow === "function")
        sourceRef.current.measureInWindow(start);
      else start(0, absoluteY - 32, 180, 64);
    },
    [previewHeight, previewOpacity, previewWidth, sourceCenterY, x, y],
  );
  const notifyMove = React.useCallback(
    (_absoluteX: number, absoluteY: number) => {
      latestAbsoluteYRef.current = absoluteY;
      if (!dragStartedRef.current) return;
      const bounds = sourceBoundsRef.current;
      callbacksRef.current.onDragMove(
        createNetworkDeviceDragEvent(
          detailsRef.current.deviceKey,
          absoluteY,
          bounds,
        ),
      );
    },
    [],
  );
  const notifyEnd = React.useCallback(
    (_absoluteX: number, absoluteY: number, cancelled: boolean) => {
      latestAbsoluteYRef.current = absoluteY;
      if (!dragStartedRef.current) {
        finalizedBeforeStartRef.current = true;
        return;
      }
      dragStartedRef.current = false;
      const bounds = sourceBoundsRef.current;
      const accepted = callbacksRef.current.onDragEnd(
        createNetworkDeviceDragEvent(
          detailsRef.current.deviceKey,
          absoluteY,
          bounds,
          cancelled,
        ),
      );
      if (accepted) {
        previewOpacity.value = 0;
        setPreviewVisible(false);
        return;
      }
      x.value = withTiming(bounds.left, { duration: 180 });
      y.value = withTiming(sourceCenterY.value, { duration: 180 });
      setTimeout(() => {
        previewOpacity.value = 0;
        setPreviewVisible(false);
      }, 180);
    },
    [previewOpacity, sourceCenterY, x, y],
  );
  /* eslint-enable react-hooks/immutability */

  /* RNGH worklets intentionally mutate Reanimated shared values and use stable
   * callback refs so this gesture is not rebuilt for scan-only prop updates. */
  /* eslint-disable react-hooks/immutability, react-hooks/refs */
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`network-device-drag-${deviceKey}`)
        .activateAfterLongPress(NETWORK_DEVICE_DRAG_LONG_PRESS_MS)
        .minPointers(1)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onStart((event) => {
          active.value = 1;
          y.value = event.absoluteY;
          scheduleOnRN(notifyStart, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          y.value = event.absoluteY;
          scheduleOnRN(notifyMove, event.absoluteX, event.absoluteY);
        })
        .onFinalize((event, success) => {
          if (active.value !== 1) return;
          active.value = 0;
          scheduleOnRN(notifyEnd, event.absoluteX, event.absoluteY, !success);
        }),
    [active, deviceKey, notifyEnd, notifyMove, notifyStart, y],
  );
  /* eslint-enable react-hooks/immutability, react-hooks/refs */
  const previewStyle = useAnimatedStyle(() => ({
    opacity: previewOpacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value - previewHeight.value / 2 },
    ],
    width: previewWidth.value,
  }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <View ref={sourceRef} collapsable={false} style={{ flex: 1 }}>
          {children}
        </View>
      </GestureDetector>
      {previewVisible ? (
        <Portal isOpen animationPreset="none" isKeyboardDismissable={false}>
          <Animated.View
            testID={`network-device-drag-preview-${deviceKey}`}
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 1,
                minWidth: 1,
                gap: eight2FiveSpacing.xs,
                padding: eight2FiveSpacing.sm,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: eight2FiveRadii.sm,
                backgroundColor: theme.surfaceRaised,
              },
              previewStyle,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontFamily: eight2FiveFonts.styleSemibold,
              }}
            >
              {displayName}
            </Text>
            <Text
              numberOfLines={1}
              size="sm"
              style={{ color: theme.textMuted }}
            >
              {identifier}
            </Text>
          </Animated.View>
        </Portal>
      ) : null}
    </>
  );
}
