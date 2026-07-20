import React from "react";
import { act } from "react-test-renderer";
import { SubappCard } from "../SubappCard";
import { renderWithAct } from "../../testUtils/renderWithAct";

describe("SubappCard", () => {
  it("shows title, badge, and triggers press", () => {
    const onPress = jest.fn();
    const tree = renderWithAct(
      <SubappCard
        title="Diagnostics"
        description="Inspect beacon data"
        badge="New"
        onPress={onPress}
      />,
    );

    const badge = tree.root.findByProps({ children: "New" });
    expect(badge).toBeTruthy();
    expect(
      tree.root.findByProps({ children: "Inspect beacon data" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: "subapp-divider-Diagnostics" }),
    ).toBeTruthy();

    const row = tree.root.findByProps({ testID: "subapp-card-Diagnostics" });
    act(() => row.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
