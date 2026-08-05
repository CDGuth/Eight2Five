import { EMPTY_FIELD_LIVE_POSITION_STATE } from "@eight2five/mobile/field";

import { getTargetDistancePresentation } from "../live-position-hud-state";

describe("live position HUD state", () => {
  test("computes physical 8-to-5 distance and threshold tones", () => {
    const live = {
      ...EMPTY_FIELD_LIVE_POSITION_STATE,
      connectionState: "connected" as const,
      position: { xMeters: 0, yMeters: 0 },
      isStale: false,
    };
    expect(
      getTargetDistancePresentation({
        live,
        target: { xMeters: 0.28575, yMeters: 0 },
        greenThresholdSteps: 0.5,
        yellowThresholdSteps: 1,
      }),
    ).toMatchObject({ value: "0.5 steps", tone: "success" });
    expect(
      getTargetDistancePresentation({
        live,
        target: { xMeters: 0.5715, yMeters: 0 },
        greenThresholdSteps: 0.5,
        yellowThresholdSteps: 1,
      }).tone,
    ).toBe("warning");
    expect(
      getTargetDistancePresentation({
        live,
        target: { xMeters: 1.143, yMeters: 0 },
        greenThresholdSteps: 0.5,
        yellowThresholdSteps: 1,
      }).tone,
    ).toBe("danger");
    expect(
      getTargetDistancePresentation({
        live: { ...live, isStale: true },
        target: { xMeters: 0, yMeters: 0 },
        greenThresholdSteps: 0.5,
        yellowThresholdSteps: 1,
      }),
    ).toEqual({ value: "–", tone: "muted" });
  });
});
