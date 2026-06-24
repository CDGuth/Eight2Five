import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View } from "react-native";
import { DraggableMarker } from "../components/DraggableMarker";

describe("DraggableMarker", () => {
  it("clamps drag movement within bounds", () => {
    const onDrag = jest.fn();
    const onDragStart = jest.fn();
    const onDragEnd = jest.fn();

    const tree = TestRenderer.create(
      <DraggableMarker
        x={5}
        y={5}
        scale={10}
        width={10}
        length={10}
        color="#000"
        onDrag={onDrag}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />,
    );

    const marker = tree.root.findByType(View);
    const handlers = marker.props;

    expect(handlers.onStartShouldSetResponder({} as any)).toBe(true);

    const startEvent = { nativeEvent: { pageX: 0, pageY: 0 } } as any;
    const moveEvent = { nativeEvent: { pageX: 100, pageY: 200 } } as any;

    act(() => handlers.onResponderGrant?.(startEvent));
    act(() => handlers.onResponderMove?.(moveEvent));
    act(() => handlers.onResponderRelease?.());

    expect(onDragStart).toHaveBeenCalled();
    // Movement scaled by 10 -> dx=10, dy=20, clamped to width/length
    expect(onDrag).toHaveBeenCalledWith(10, 10);
    expect(onDragEnd).toHaveBeenCalled();
  });
});
