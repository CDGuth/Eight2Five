import React from "react";
import { act } from "react-test-renderer";
import { LabelWithTooltip } from "../components/LabelWithTooltip";
import { renderWithAct } from "../../../testUtils/renderWithAct";

describe("LabelWithTooltip", () => {
  it("shows alert when pressed", () => {
    const tree = renderWithAct(
      <LabelWithTooltip label="Help" tooltip="More info" />,
    );

    const tooltip = tree.root.findByProps({
      accessibilityLabel: "Show help for Help",
    });
    act(() => tooltip.props.onPress());

    expect((globalThis as any).__TESTBED_TOAST_SHOW__).toHaveBeenCalled();
  });
});
