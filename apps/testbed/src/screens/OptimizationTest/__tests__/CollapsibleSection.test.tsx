import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import { CollapsibleSection } from "../components/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("collapses and expands children", () => {
    const tree = TestRenderer.create(
      <CollapsibleSection title="Example">
        <Text>Child</Text>
      </CollapsibleSection>,
    );

    const initialCount = tree.root.findAllByProps({ children: "Child" }).length;

    act(() => {
      tree.root.findByType(TouchableOpacity).props.onPress();
    });

    const collapsedCount = tree.root.findAllByProps({
      children: "Child",
    }).length;
    expect(collapsedCount).toBeLessThan(initialCount);
  });
});
