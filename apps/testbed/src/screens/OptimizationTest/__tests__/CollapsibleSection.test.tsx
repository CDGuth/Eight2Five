import React from "react";
import { act } from "react-test-renderer";
import { Text } from "react-native";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { renderWithAct } from "../../../testUtils/renderWithAct";

describe("CollapsibleSection", () => {
  it("collapses and expands children", () => {
    const tree = renderWithAct(
      <CollapsibleSection title="Example">
        <Text>Child</Text>
      </CollapsibleSection>,
    );

    const initialCount = tree.root.findAllByProps({ children: "Child" }).length;

    act(() => {
      tree.root.findByProps({ accessibilityLabel: "Example" }).props.onPress();
    });

    const collapsedCount = tree.root.findAllByProps({
      children: "Child",
    }).length;
    expect(collapsedCount).toBeLessThan(initialCount);
  });
});
