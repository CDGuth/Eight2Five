import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View, PanResponder } from "react-native";
import { DraggableMarker } from "../components/DraggableMarker";

const originalPanResponderCreate = PanResponder.create;

beforeAll(() => {
  (PanResponder as any).create = (handlers: any) => ({
    panHandlers: {
      onStartShouldSetResponder:
        handlers.onStartShouldSetPanResponder ??
        handlers.onStartShouldSetResponder,
      onResponderGrant: handlers.onPanResponderGrant,
      onResponderMove: handlers.onPanResponderMove,
      onResponderRelease: handlers.onPanResponderRelease,
    },
  });
});

afterAll(() => {
  (PanResponder as any).create = originalPanResponderCreate;
});

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

    const mockEvent = { touchHistory: {} } as any;
    const gesture = { dx: 100, dy: 200 } as any;

    act(() => handlers.onResponderGrant?.(mockEvent, gesture));
    act(() => handlers.onResponderMove?.(mockEvent, gesture));
    act(() => handlers.onResponderRelease?.());

    expect(onDragStart).toHaveBeenCalled();
    // Movement scaled by 10 -> dx=10, dy=20, clamped to width/length
    expect(onDrag).toHaveBeenCalledWith(10, 10);
    expect(onDragEnd).toHaveBeenCalled();
  });
});
