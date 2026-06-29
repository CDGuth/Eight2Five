import React from "react";
import { View } from "react-native";
import { HeatmapOverlay } from "../components/HeatmapOverlay";
import { RunResult } from "../types";
import { renderWithAct } from "../../../testUtils/renderWithAct";

jest.mock("@eight2five/mobile/localization/models/TwoRayGroundModel", () => ({
  TwoRayGroundModel: jest.fn().mockImplementation(() => ({
    estimateRssi: () => -50,
  })),
}));

jest.mock("@eight2five/mobile/localization/models/LogNormalModel", () => ({
  LogNormalModel: jest.fn().mockImplementation(() => ({
    estimateRssi: () => -52,
  })),
}));

const baseResult: RunResult = {
  id: 1,
  params: {},
  truePos: { x: 0, y: 0 },
  estPos: { x: 0, y: 0 },
  error: 0,
  rssiRmse: 0,
  duration: 0,
  iterations: 1,
  anchors: [{ mac: "a1", x: 0, y: 0 }],
  measurements: [{ mac: "a1", lastSeen: 0, filteredRssi: -45, txPower: -59 }],
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

describe("HeatmapOverlay", () => {
  it("renders a Skia rect for each sample point", () => {
    const tree = renderWithAct(
      <HeatmapOverlay
        width={10}
        length={10}
        scale={1}
        result={baseResult}
        resolution={2}
      />,
    );

    const container = tree.root.find(
      (node) => node.type === View && node.props.pointerEvents === "none",
    );

    expect(container).toBeTruthy();
    expect(
      tree.root.findAll(
        (node) => node.type === View && node.props.testID === "skia-rect",
      ),
    ).toHaveLength(4);
  });
});
