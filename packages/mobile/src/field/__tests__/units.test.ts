import {
  FEET_PER_YARD,
  METERS_PER_FOOT,
  METERS_PER_YARD,
  STANDARD_STEP_METERS,
  STANDARD_STEPS_PER_FIVE_YARDS,
  feetToMeters,
  metersToFeet,
  metersToStandardSteps,
  metersToYards,
  standardStepsToMeters,
  standardStepsToYards,
  yardsToMeters,
  yardsToStandardSteps,
} from "../index";

describe("field units", () => {
  test("uses the exact SI and standard 8-to-5 constants", () => {
    expect(METERS_PER_YARD).toBe(0.9144);
    expect(METERS_PER_FOOT).toBe(0.3048);
    expect(FEET_PER_YARD).toBe(3);
    expect(STANDARD_STEP_METERS).toBe(0.5715);
    expect(STANDARD_STEPS_PER_FIVE_YARDS).toBe(8);
  });

  test("converts yards, feet, and standard steps", () => {
    expect(yardsToMeters(1)).toBe(0.9144);
    expect(feetToMeters(1)).toBe(0.3048);
    expect(standardStepsToMeters(8)).toBeCloseTo(yardsToMeters(5));
    expect(metersToYards(yardsToMeters(12.5))).toBeCloseTo(12.5);
    expect(metersToFeet(feetToMeters(53 + 4 / 12))).toBeCloseTo(53 + 4 / 12);
    expect(metersToStandardSteps(standardStepsToMeters(3.25))).toBeCloseTo(
      3.25,
    );
    expect(yardsToStandardSteps(5)).toBeCloseTo(8);
    expect(standardStepsToYards(8)).toBeCloseTo(5);
  });

  test("rejects non-finite unit values", () => {
    expect(() => yardsToMeters(Number.NaN)).toThrow("Yards");
    expect(() => metersToFeet(Number.POSITIVE_INFINITY)).toThrow("Meters");
  });
});
