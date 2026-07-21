import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
  cancelled?: boolean;
}

export interface NetworkDeviceDragProps {
  deviceKey: string;
  displayName: string;
  identifier: string;
  children: React.ReactNode;
  onDragStart(event: NetworkDeviceDragEvent): void;
  onDragMove(event: NetworkDeviceDragEvent): void;
  onDragEnd(event: NetworkDeviceDragEvent): void;
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
  const active = useSharedValue(0);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const detailsRef = React.useRef({ deviceKey, displayName, identifier });
  const callbacksRef = React.useRef({ onDragStart, onDragMove, onDragEnd });
  React.useEffect(() => {
    detailsRef.current = { deviceKey, displayName, identifier };
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd };
  }, [deviceKey, displayName, identifier, onDragEnd, onDragMove, onDragStart]);

  const notifyStart = React.useCallback(
    (absoluteX: number, absoluteY: number) => {
      setPreviewVisible(true);
      callbacksRef.current.onDragStart({
        deviceKey: detailsRef.current.deviceKey,
        x: absoluteX,
        y: absoluteY,
      });
    },
    [],
  );
  const notifyMove = React.useCallback(
    (absoluteX: number, absoluteY: number) => {
      callbacksRef.current.onDragMove({
        deviceKey: detailsRef.current.deviceKey,
        x: absoluteX,
        y: absoluteY,
      });
    },
    [],
  );
  const notifyEnd = React.useCallback(
    (absoluteX: number, absoluteY: number, cancelled: boolean) => {
      setPreviewVisible(false);
      callbacksRef.current.onDragEnd({
        deviceKey: detailsRef.current.deviceKey,
        x: absoluteX,
        y: absoluteY,
        cancelled,
      });
    },
    [],
  );

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
          x.value = event.absoluteX;
          y.value = event.absoluteY;
          scheduleOnRN(notifyStart, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          x.value = event.absoluteX;
          y.value = event.absoluteY;
          scheduleOnRN(notifyMove, event.absoluteX, event.absoluteY);
        })
        .onFinalize((event, success) => {
          if (active.value !== 1) return;
          active.value = 0;
          scheduleOnRN(notifyEnd, event.absoluteX, event.absoluteY, !success);
        }),
    [active, deviceKey, notifyEnd, notifyMove, notifyStart, x, y],
  );
  /* eslint-enable react-hooks/immutability, react-hooks/refs */
  const previewStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [
      { translateX: x.value + eight2FiveSpacing.sm },
      { translateY: y.value + eight2FiveSpacing.sm },
    ],
  }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={{ flex: 1 }}>
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
                minWidth: 180,
                maxWidth: "80%",
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
