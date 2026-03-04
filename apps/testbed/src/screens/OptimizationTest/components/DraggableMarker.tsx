import React, { useRef } from "react";
import { View, PanResponder } from "react-native";

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
  const propsRef = useRef({ x, y, scale, width, length, onDrag });
  propsRef.current = { x, y, scale, width, length, onDrag };
  const isEditableRef = useRef(isEditable);
  isEditableRef.current = isEditable;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isEditableRef.current,
      onMoveShouldSetPanResponder: () => isEditableRef.current,
      onPanResponderGrant: () => {
        if (!isEditableRef.current) return;
        startPosRef.current = { x: propsRef.current.x, y: propsRef.current.y };
        onDragStart?.();
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isEditableRef.current) return;
        const { scale, width, length, onDrag } = propsRef.current;
        if (scale === 0) return;

        const dx = gestureState.dx / scale;
        const dy = gestureState.dy / scale;

        const newX = Math.max(0, Math.min(width, startPosRef.current.x + dx));
        const newY = Math.max(0, Math.min(length, startPosRef.current.y + dy));

        onDrag(newX, newY);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
    }),
  ).current;

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
      {...panResponder.panHandlers}
    />
  );
};
