import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SweepGraph } from "../components/SweepGraph";

describe("SweepGraph", () => {
  it("forwards point selection", () => {
    const onSelectPoint = jest.fn();
    const tree = TestRenderer.create(
      <SweepGraph
        results={[
          { val: 1, avgError: 1, stdDev: 0.1, avgIterations: 2, runs: [] },
          { val: 2, avgError: 0.5, stdDev: 0.05, avgIterations: 2, runs: [] },
        ]}
        paramName="population"
        onSelectPoint={onSelectPoint}
        selectedIndex={null}
      />,
    );

    const graph = tree.root.findByType(SweepGraph);
    act(() => graph.props.onSelectPoint?.(1));
    expect(onSelectPoint).toHaveBeenCalledWith(1);
  });
});
