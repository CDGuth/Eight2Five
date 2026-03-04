import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View, Text, TouchableOpacity } from "react-native";
import { Visualization } from "../components/Visualization";
import { HeatmapOverlay } from "../components/HeatmapOverlay";
import { RunResult } from "../types";

const sampleResult: RunResult = {
  id: 1,
  params: {},
  truePos: { x: 2, y: 3 },
  estPos: { x: 4, y: 5 },
  error: 1,
  rssiRmse: 0.5,
  duration: 10,
  iterations: 2,
  initialPopulation: [{ x: 1, y: 1 }],
  finalPopulation: [{ x: 2, y: 2 }],
  anchors: [{ mac: "a1", x: 0, y: 0 }],
  measurements: [{ mac: "a1", lastSeen: 0, filteredRssi: -50, txPower: -59 }],
  modelType: "TwoRayGround",
  constants: {
    transmitterHeightMeters: 1,
    receiverHeightMeters: 1,
    frequencyHz: 2.4e9,
    transmitterGain: 1,
    receiverGain: 1,
    reflectionCoefficient: 1,
  },
};

describe("Visualization", () => {
  it("renders heatmap when enabled and forwards toggle", () => {
    const onToggleHeatmap = jest.fn();
    const tree = TestRenderer.create(
      <Visualization
        width={10}
        length={10}
        result={sampleResult}
        currentAnchors={sampleResult.anchors}
        currentTruePos={sampleResult.truePos}
        currentInitialFireflies={sampleResult.initialPopulation}
        onUpdateTruePos={jest.fn()}
        onUpdateAnchor={jest.fn()}
        isRandomTruePos={false}
        onDragStart={jest.fn()}
        onDragEnd={jest.fn()}
        isRunning={false}
        showHeatmap
        onToggleHeatmap={onToggleHeatmap}
        isSetup={false}
        hideControls={false}
        useWhiteBackground
        heatmapResolution="10"
        onResolutionChange={jest.fn()}
      />,
    );

    const field = tree.root.find(
      (node) => node.type === View && typeof node.props.onLayout === "function",
    );

    act(() =>
      field.props.onLayout({
        nativeEvent: { layout: { width: 100, height: 100 } },
      }),
    );

    const overlay = tree.root.findByType(HeatmapOverlay);
    expect(overlay).toBeDefined();

    const toggle = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) =>
        node
          .findAllByType(Text)
          .some((child) => child.props.children === "Hide Heatmap"),
      );
    if (!toggle) throw new Error("Toggle not found");
    act(() => toggle.props.onPress());
    expect(onToggleHeatmap).toHaveBeenCalled();
  });
});
