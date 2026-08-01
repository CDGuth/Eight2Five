import { calculateFieldGuidance, standardStepsToMeters } from "../index";

describe("field guidance", () => {
  test("returns signed field-relative axis guidance and straight-line distance", () => {
    const guidance = calculateFieldGuidance(
      { xMeters: standardStepsToMeters(10), yMeters: standardStepsToMeters(5) },
      {
        xMeters: standardStepsToMeters(2.5),
        yMeters: standardStepsToMeters(8),
      },
    );
    expect(guidance.xDisplacementSteps).toBeCloseTo(-7.5);
    expect(guidance.yDisplacementSteps).toBeCloseTo(3);
    expect(guidance.distanceSteps).toBeCloseTo(Math.hypot(7.5, 3));
    expect(guidance.xLabel).toBe("7.5 steps toward Side 1");
    expect(guidance.yLabel).toBe("3 steps toward the back sideline");
  });

  test("uses front-sideline wording for negative Y and no phone heading", () => {
    const guidance = calculateFieldGuidance(
      { xMeters: 0, yMeters: standardStepsToMeters(3) },
      { xMeters: 0, yMeters: 0 },
    );
    expect(guidance.yDisplacementSteps).toBe(-3);
    expect(guidance.yLabel).toBe("3 steps toward the front sideline");
    expect(guidance).not.toHaveProperty("heading");
    expect(guidance).not.toHaveProperty("bearing");
  });

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
