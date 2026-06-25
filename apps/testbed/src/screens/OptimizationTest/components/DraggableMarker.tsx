import React, { useRef } from "react";
import { View } from "react-native";

export const DraggableMarker = ({
  x,
  y,
  scale,
  width,
  length,
  color,
  size = 12,
  onDrag,
  onDragStart,
  onDragEnd,
  isEditable = true,
  style,
}: {
  x: number;
  y: number;
  scale: number;
  width: number;
  length: number;
  color: string;
  size?: number;
  onDrag: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isEditable?: boolean;
  style?: any;
}) => {
  const startPosRef = useRef({ x: 0, y: 0 });
  const startTouchRef = useRef({ pageX: 0, pageY: 0 });

  return (
    <View
      style={[
        {
          position: "absolute",
          left: x * scale - size / 2,
          top: y * scale - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: "#fff",
          zIndex: 10,
        },
        style,
      ]}
      hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
      onStartShouldSetResponder={() => isEditable}
      onMoveShouldSetResponder={() => isEditable}
      onResponderGrant={(event) => {
        if (!isEditable) return;

        startPosRef.current = { x, y };
        startTouchRef.current = {
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        };
        onDragStart?.();
      }}
      onResponderMove={(event) => {
        if (!isEditable || scale === 0) return;

        const dx =
          (event.nativeEvent.pageX - startTouchRef.current.pageX) / scale;
        const dy =
          (event.nativeEvent.pageY - startTouchRef.current.pageY) / scale;
        const newX = Math.max(0, Math.min(width, startPosRef.current.x + dx));
        const newY = Math.max(0, Math.min(length, startPosRef.current.y + dy));

        onDrag(newX, newY);
      }}
      onResponderTerminationRequest={() => false}
      onResponderRelease={() => {
        onDragEnd?.();
      }}
    />
  );
};
