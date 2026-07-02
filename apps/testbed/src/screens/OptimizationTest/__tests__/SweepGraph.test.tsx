import React from "react";
import { act } from "react-test-renderer";
import { SweepGraph } from "../components/SweepGraph";
import { renderWithAct } from "../../../testUtils/renderWithAct";

describe("SweepGraph", () => {
  it("forwards original point index after sorting by sweep value", () => {
    const onSelectPoint = jest.fn();
    const tree = renderWithAct(
      <SweepGraph
        results={[
          { val: 2, avgError: 1, stdDev: 0.1, avgIterations: 2, runs: [] },
          { val: 1, avgError: 0.5, stdDev: 0.05, avgIterations: 2, runs: [] },
        ]}
        paramName="population"
        onSelectPoint={onSelectPoint}
        selectedIndex={null}
      />,
    );

    const firstSortedPoint = tree.root.findByProps({
      accessibilityLabel: "Sweep point 2",
    });
    act(() => firstSortedPoint.props.onPress());
    expect(onSelectPoint).toHaveBeenCalledWith(1);
  });
});
