import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import { ResultsView } from "../ResultsView";
import { BatchAnalysis, LogBatch, RunResult, SweepStepResult } from "../types";

jest.setTimeout(15000);

const render = (el: React.ReactElement) => {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(el);
  });
  if (!tree) throw new Error("Failed to render");
  return tree;
};

const baseConstants = {
  transmitterHeightMeters: 1,
  receiverHeightMeters: 1,
  frequencyHz: 2.4e9,
  transmitterGain: 1,
  receiverGain: 1,
  reflectionCoefficient: 1,
};

const results: RunResult[] = [
  {
    id: 1,
    params: {},
    truePos: { x: 0, y: 0 },
    estPos: { x: 1, y: 1 },
    error: 1,
    rssiRmse: 0.5,
    duration: 10,
    iterations: 5,
    anchors: [{ mac: "a1", x: 0, y: 0 }],
    measurements: [{ mac: "a1", lastSeen: 0, filteredRssi: -40, txPower: -59 }],
    modelType: "TwoRayGround",
    constants: baseConstants,
  },
  {
    id: 2,
    params: {},
    truePos: { x: 0, y: 0 },
    estPos: { x: 2, y: 2 },
    error: 0.5,
    rssiRmse: 0.3,
    duration: 8,
    iterations: 4,
    anchors: [{ mac: "a1", x: 0, y: 0 }],
    measurements: [{ mac: "a1", lastSeen: 0, filteredRssi: -38, txPower: -59 }],
    modelType: "TwoRayGround",
    constants: baseConstants,
  },
];

const batchAnalysis: BatchAnalysis = {
  avgError: 0.75,
  stdDev: 0.2,
  rmse: 0.8,
  avgRssiRmse: 0.4,
  medianError: 0.75,
  minError: 0.5,
  maxError: 1,
  avgDuration: 9,
  avgIterations: 4.5,
  successRate1m: 50,
  successRate2m: 100,
  totalRuns: 2,
  bestRuns: results,
};

const sweepResults: SweepStepResult[] = [
  {
    val: 1,
    avgError: 0.5,
    stdDev: 0.1,
    avgIterations: 3,
    runs: [results[1]],
  },
];

const logBatches: LogBatch[] = [
  {
    id: 1,
    startTime: Date.now(),
    entries: [{ timestamp: Date.now(), message: "log entry" }],
    type: "Standard",
  },
];

describe("ResultsView", () => {
  it("copies analysis, toggles averages, selects runs, and clears logs", async () => {
    const onSelectResultIndex = jest.fn();
    const onClearLogs = jest.fn();
    const onToggleScroll = jest.fn();

    const tree: TestRenderer.ReactTestRenderer = render(
      <ResultsView
        results={results}
        batchAnalysis={batchAnalysis}
        logBatches={logBatches}
        sweepResults={sweepResults}
        sweepConfig={{
          param: "populationSize",
          min: "1",
          max: "1",
          step: "1",
          runsPerStep: "1",
        }}
        testMode="sweep"
        selectedResultIndex={0}
        onSelectResultIndex={onSelectResultIndex}
        onClearLogs={onClearLogs}
        onToggleScroll={onToggleScroll}
      />,
    );

    const copyAnalysis = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: any) =>
        n.findAllByType(Text).some((t: any) => t.props.children === "Copy"),
      );
    await act(async () => {
      await copyAnalysis?.props.onPress();
    });

    const showAverages = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: any) =>
        n
          .findAllByType(Text)
          .some((t: any) => t.props.children === "Show Averages"),
      );
    act(() => showAverages?.props.onPress());

    const copyGraph = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: any) =>
        n
          .findAllByType(Text)
          .some((t: any) => t.props.children === "Copy Graph"),
      );
    await act(async () => {
      await copyGraph?.props.onPress();
    });

    const logsHeader = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: any) =>
        n.findAllByType(Text).some((t: any) => t.props.children === "Logs"),
      );
    act(() => logsHeader?.props.onPress());

    const clearLogs = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: any) =>
        n
          .findAllByType(Text)
          .some((t: any) => t.props.children === "Clear Logs"),
      );
    act(() => clearLogs?.props.onPress());

    const dropdown = tree.root.findByProps({ label: "Select Run" });
    act(() => dropdown.props.onToggle(true));
    act(() => dropdown.props.onSelect("1"));

    expect(onSelectResultIndex).toHaveBeenCalledWith(1);
    expect(onClearLogs).toHaveBeenCalled();
    expect(onToggleScroll).toHaveBeenCalledWith(false);
    expect(Clipboard.setStringAsync).toHaveBeenCalled();
    expect(captureRef).toHaveBeenCalled();
  });
});
