import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, TouchableOpacity } from "react-native";
import { LabelWithTooltip } from "../components/LabelWithTooltip";

describe("LabelWithTooltip", () => {
  it("shows alert when pressed", () => {
    const tree = TestRenderer.create(
      <LabelWithTooltip label="Help" tooltip="More info" />,
    );

    const tooltip = tree.root.findByType(TouchableOpacity);
    act(() => tooltip.props.onPress());

    expect(Alert.alert).toHaveBeenCalledWith("Help", "More info");
  });
});
