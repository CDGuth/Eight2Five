import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import { captureRef } from "react-native-view-shot";
import OptimizationTestScreen from "..";
import { RunResult } from "../types";
jest.setTimeout(30000);

beforeAll(() => {
  jest.useRealTimers();
});

function createSampleRun(): RunResult {
  return {
    id: 1,
    params: {},
    truePos: { x: 0, y: 0 },
    estPos: { x: 1, y: 1 },
    error: 0.5,
    rssiRmse: 0.2,
    duration: 5,
    iterations: 3,
    initialPopulation: [{ x: 0, y: 0 }],
    finalPopulation: [{ x: 1, y: 1 }],
    anchors: [{ mac: "a1", x: 0, y: 0 }],
    measurements: [{ mac: "a1", lastSeen: 0, filteredRssi: -40, txPower: -59 }],
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
}

function createBaseState() {
  return {
    inputWidth: "10",
    inputLength: "20",
    fieldWidth: 10,
    fieldLength: 20,
    fieldPreset: "custom",
    numAnchors: "2",
    txHeight: "1",
    rxHeight: "1",
    freq: "2400000000",
    txGain: "1",
    rxGain: "1",
    refCoeff: "1",
    iterationTimeLimit: "10",
    maxIterations: "10",
    populationSize: "5",
    beta0: "1",
    lightAbsorption: "0.5",
    alpha: "0.2",
    initialTemperature: "10",
    coolingRate: "0.9",
    selectedModel: "TwoRayGround",
    selectedAlgorithm: "MFASA",
    selectedFilter: "Kalman",
    sourceMode: "ble-rssi",
    uwbDistanceSigma: "0.15",
    isSolverWeighted: false,
    solverWeightingModel: "linear",
    solverWeightingBase: "120",
    solverWeightingScale: "1",
    solverWeightingParam: "1",
    isNoiseEnabled: true,
    noiseWeightingModel: "linear",
    noiseBase: "1",
    noiseScale: "1",
    noiseParameter: "1",
    isRandomTruePos: true,
    manualTrueX: "1",
    manualTrueY: "1",
    currentTruePos: { x: 1, y: 1 },
    anchorPlacementMode: "border",
    anchorSigma: "0.1",
    currentAnchors: [{ mac: "1", x: 0, y: 0 }],
    fireflyPlacementMode: "random",
    fireflySigma: "0.1",
    currentInitialFireflies: [],
    isRegenerateFirefliesEveryRun: true,
    testMode: "standard",
    numRuns: "1",
    sweepConfig: {
      param: "populationSize",
      min: "1",
      max: "1",
      step: "1",
      runsPerStep: "1",
    },
    heatmapResolution: "50",
    isRunning: false,
    progress: 0,
    logBatches: [],
    results: [createSampleRun()],
    sweepResults: [],
    batchAnalysis: null,
    viewMode: "config",
  };
}

const setterNames = [
  "setInputWidth",
  "setInputLength",
  "setFieldWidth",
  "setFieldLength",
  "setNumAnchors",
  "setTxHeight",
  "setRxHeight",
  "setFreq",
  "setTxGain",
  "setRxGain",
  "setRefCoeff",
  "setIterationTimeLimit",
  "setMaxIterations",
  "setPopulationSize",
  "setBeta0",
  "setLightAbsorption",
  "setAlpha",
  "setInitialTemperature",
  "setCoolingRate",
  "setSelectedModel",
  "setSelectedAlgorithm",
  "setSelectedFilter",
  "setSourceMode",
  "setUwbDistanceSigma",
  "setIsSolverWeighted",
  "setSolverWeightingModel",
  "setSolverWeightingBase",
  "setSolverWeightingScale",
  "setSolverWeightingParam",
  "setIsNoiseEnabled",
  "setNoiseWeightingModel",
  "setNoiseBase",
  "setNoiseScale",
  "setNoiseParameter",
  "setIsRandomTruePos",
  "setManualTrueX",
  "setManualTrueY",
  "setCurrentTruePos",
  "setAnchorPlacementMode",
  "setAnchorSigma",
  "setCurrentAnchors",
  "setFireflyPlacementMode",
  "setFireflySigma",
  "setIsRegenerateFirefliesEveryRun",
  "setCurrentInitialFireflies",
  "setTestMode",
  "setNumRuns",
  "setSweepConfig",
  "setHeatmapResolution",
  "setLogBatches",
  "setViewMode",
];

const actionNames = [
  "handlePresetChange",
  "generateAnchors",
  "generateFireflies",
  "runOptimizationTest",
  "cancelTest",
  "resetResults",
];

type MockMap = Record<string, jest.Mock>;

function createSetters(): MockMap {
  const result: MockMap = {};
  setterNames.forEach((name) => {
    result[name] = jest.fn();
  });
  return result;
}

function createActions(): MockMap {
  const result: MockMap = {};
  actionNames.forEach((name) => {
    result[name] = jest.fn();
  });
  return result;
}

let mockState = createBaseState();
const mockSetters: MockMap = createSetters();
const mockActions: MockMap = createActions();

jest.mock("../hooks/useOptimizationRunner", () => ({
  useOptimizationRunner: jest.fn(() => ({
    state: mockState,
    setters: mockSetters,
    actions: mockActions,
  })),
  __setMockState: (nextState: any) => {
    mockState = nextState;
  },
  __getMocks: () => ({ mockSetters, mockActions }),
}));

jest.mock("../components/Visualization", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    Visualization: ({ onToggleHeatmap }: any) => (
      <Text testID="visualization" onPress={onToggleHeatmap}>
        Visualization
      </Text>
    ),
  };
});

jest.mock("../ResultsView", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    ResultsView: (props: any) => (
      <Text testID="results-view" onPress={() => props.onSelectResultIndex(2)}>
        Results
      </Text>
    ),
  };
});

describe("OptimizationTestScreen", () => {
  beforeEach(() => {
    mockState = createBaseState();
    Object.values(mockSetters).forEach((fn) => fn.mockClear());
    Object.values(mockActions).forEach((fn) => fn.mockClear());
  });

  const render = (
    props: Partial<React.ComponentProps<typeof OptimizationTestScreen>> = {},
  ): TestRenderer.ReactTestRenderer => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(<OptimizationTestScreen {...props} />);
    });
    if (!tree) throw new Error("Failed to render screen");
    return tree;
  };

  it("triggers run action and copies visualization", async () => {
    const tree = render();

    const runButton = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: TestRenderer.ReactTestInstance) =>
        n
          .findAllByType(Text)
          .some(
            (t: TestRenderer.ReactTestInstance) =>
              t.props.children === "Run Optimization Test",
          ),
      );
    await act(async () => {
      await runButton?.props.onPress();
    });
    expect(mockActions.runOptimizationTest).toHaveBeenCalled();

    const copyButton = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: TestRenderer.ReactTestInstance) =>
        n
          .findAllByType(Text)
          .some(
            (t: TestRenderer.ReactTestInstance) =>
              t.props.children === "Copy Image",
          ),
      );
    await act(async () => {
      await copyButton?.props.onPress();
    });

    expect(captureRef).toHaveBeenCalled();
  });

  it("shows results back action and invokes navigation actions", async () => {
    mockState = { ...createBaseState(), viewMode: "results", isRunning: false };
    const tree = render();

    const configBackButton = tree.root
      .findAllByType(TouchableOpacity)
      .find((n: TestRenderer.ReactTestInstance) =>
        n
          .findAllByType(Text)
          .some(
            (t: TestRenderer.ReactTestInstance) =>
              t.props.children === "Back to Configuration",
          ),
      );

    act(() => configBackButton?.props.onPress());

    expect(mockSetters.setViewMode).toHaveBeenCalledWith("config");
    expect(mockActions.resetResults).toHaveBeenCalled();

    const resultsView = tree.root.findByProps({ testID: "results-view" });
    act(() => resultsView.props.onPress());
    expect(mockSetters.setViewMode).toHaveBeenCalledTimes(1);
  });
});
