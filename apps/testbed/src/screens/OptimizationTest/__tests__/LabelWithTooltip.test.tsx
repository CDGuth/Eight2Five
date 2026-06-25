import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import { LabelWithTooltip } from "../components/LabelWithTooltip";

describe("LabelWithTooltip", () => {
  it("shows alert when pressed", () => {
    const tree = TestRenderer.create(
      <LabelWithTooltip label="Help" tooltip="More info" />,
    );

    const tooltip = tree.root.findByProps({
      accessibilityLabel: "Show help for Help",
    });
    act(() => tooltip.props.onPress());

    expect(Alert.alert).toHaveBeenCalledWith("Help", "More info");
  });
});
