import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";

import { calculateFieldGuidance, drillGridPointToFieldPoint } from "../index";

const PRESETS = FIELD_PRESET_IDS;

describe("field guidance", () => {
  test("returns signed field-relative axis guidance and straight-line grid distance", () => {
    const current = drillGridPointToFieldPoint(
      { xSteps: 10, ySteps: 5 },
      "football-nfhs",
    );
    const target = drillGridPointToFieldPoint(
      { xSteps: 2.5, ySteps: 8 },
      "football-nfhs",
    );
    const guidance = calculateFieldGuidance(current, target, "football-nfhs");

    expect(guidance.xDisplacementSteps).toBeCloseTo(-7.5);
    expect(guidance.yDisplacementSteps).toBeCloseTo(3);
    expect(guidance.distanceSteps).toBeCloseTo(Math.hypot(7.5, 3));
    expect(guidance.xLabel).toBe("7.5 steps toward Side 1");
    expect(guidance.yLabel).toBe("3 steps toward the back sideline");
  });

  test("uses front-sideline wording for negative Y and no phone heading", () => {
    const guidance = calculateFieldGuidance(
      drillGridPointToFieldPoint({ xSteps: 0, ySteps: 3 }),
      drillGridPointToFieldPoint({ xSteps: 0, ySteps: 0 }),
    );
    expect(guidance.yDisplacementSteps).toBeCloseTo(-3);
    expect(guidance.yLabel).toBe("3 steps toward the front sideline");
    expect(guidance).not.toHaveProperty("heading");
    expect(guidance).not.toHaveProperty("bearing");
  });

  test.each(PRESETS)(
    "%s reports exactly 84 marching steps sideline to sideline",
    (preset) => {
      const front = drillGridPointToFieldPoint(
        { xSteps: 0, ySteps: 0 },
        preset,
      );
      const back = drillGridPointToFieldPoint(
        { xSteps: 0, ySteps: 84 },
        preset,
      );
      const guidance = calculateFieldGuidance(front, back, preset);

      expect(guidance.xDisplacementSteps).toBeCloseTo(0);
      expect(guidance.yDisplacementSteps).toBeCloseTo(84);
      expect(guidance.distanceSteps).toBeCloseTo(84);
    },
  );

  test("returns zero-axis guidance without inventing a direction", () => {
    const guidance = calculateFieldGuidance(
      { xMeters: 0, yMeters: 0 },
      { xMeters: 0, yMeters: 0 },
    );
    expect(guidance.distanceSteps).toBe(0);
    expect(guidance.xLabel).toBe("0 steps");
    expect(guidance.yLabel).toBe("0 steps");
  });
});
