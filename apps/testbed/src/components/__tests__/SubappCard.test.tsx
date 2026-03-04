import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SubappCard } from "../SubappCard";

describe("SubappCard", () => {
  it("shows title, badge, and triggers press", () => {
    const onPress = jest.fn();
    const tree = TestRenderer.create(
      <SubappCard
        title="Diagnostics"
        description="Inspect beacon data"
        badge="New"
        onPress={onPress}
      />,
    );

    const badge = tree.root.findByProps({ children: "New" });
    expect(badge).toBeTruthy();

    const card = tree.root.findByProps({ testID: "subapp-card-Diagnostics" });
    act(() => card.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
