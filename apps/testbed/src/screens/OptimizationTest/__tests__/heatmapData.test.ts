import { createHeatmapData } from "../visualization/heatmapData";
import { RunResult } from "../types";

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

describe("createHeatmapData", () => {
  it("creates one cell for each sample point", () => {
    const heatmap = createHeatmapData({
      width: 10,
      length: 10,
      result: baseResult,
      resolution: 2,
    });

    expect(heatmap.cells).toHaveLength(4);
    expect(heatmap.stepX).toBe(5);
    expect(heatmap.stepY).toBe(5);
    expect(heatmap.minError).toBe(5);
    expect(heatmap.maxError).toBe(5);
    expect(heatmap.cells[0].color).toMatch(/^rgba\(/);
  });

  it("ignores measurements without matching anchors", () => {
    const heatmap = createHeatmapData({
      width: 10,
      length: 10,
      result: {
        ...baseResult,
        measurements: [
          { mac: "missing", lastSeen: 0, filteredRssi: -45, txPower: -59 },
        ],
      },
      resolution: 2,
    });

    expect(heatmap.cells.every((cell) => cell.error === 0)).toBe(true);
  });
});
