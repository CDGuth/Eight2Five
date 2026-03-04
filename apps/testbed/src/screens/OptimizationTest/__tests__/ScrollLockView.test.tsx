import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View } from "react-native";
import { ScrollLockView } from "../components/ScrollLockView";

describe("ScrollLockView", () => {
  it("locks and unlocks scrolling when touched", () => {
    const onToggleScroll = jest.fn();
    const tree = TestRenderer.create(
      <ScrollLockView onToggleScroll={onToggleScroll}>
        <View testID="content" />
      </ScrollLockView>,
    );

    const host = tree.root.findByType(View);
    expect(host.props.onStartShouldSetResponderCapture()).toBe(false);
    expect(onToggleScroll).toHaveBeenCalledWith(false);

    act(() => host.props.onTouchEnd?.({} as any));
    expect(onToggleScroll).toHaveBeenCalledWith(true);
  });
});
