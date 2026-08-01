import { assertFiniteFieldPoint } from "./types";

/** Exact SI conversion constants used by every field-domain calculation. */
export const METERS_PER_YARD = 0.9144;
export const METERS_PER_FOOT = 0.3048;
export const FEET_PER_YARD = 3;
export const YARDS_PER_FOOT = 1 / FEET_PER_YARD;

/** Standard marching is eight steps over five yards (22.5 inches per step). */
export const STANDARD_STEPS_PER_FIVE_YARDS = 8;
export const STANDARD_STEP_METERS = 0.5715;
export const FIVE_YARDS_IN_STANDARD_STEPS = STANDARD_STEPS_PER_FIVE_YARDS;
export const STANDARD_STEPS_PER_5_YARDS = STANDARD_STEPS_PER_FIVE_YARDS;
export const STANDARD_8_TO_5_STEPS = STANDARD_STEPS_PER_FIVE_YARDS;
export const METERS_PER_STANDARD_STEP = STANDARD_STEP_METERS;

export const YARDS_PER_STANDARD_STEP = STANDARD_STEP_METERS / METERS_PER_YARD;
export const FEET_PER_STANDARD_STEP = STANDARD_STEP_METERS / METERS_PER_FOOT;
export const STANDARD_STEPS_PER_YARD = 1 / YARDS_PER_STANDARD_STEP;
export const STANDARD_STEPS_PER_FOOT = STANDARD_STEPS_PER_YARD / FEET_PER_YARD;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

export function yardsToMeters(yards: number): number {
  assertFinite(yards, "Yards");
  return yards * METERS_PER_YARD;
}

export function metersToYards(meters: number): number {
  assertFinite(meters, "Meters");
  return meters / METERS_PER_YARD;
}

export function feetToMeters(feet: number): number {
  assertFinite(feet, "Feet");
  return feet * METERS_PER_FOOT;
}

export function metersToFeet(meters: number): number {
  assertFinite(meters, "Meters");
  return meters / METERS_PER_FOOT;
}

export function standardStepsToMeters(steps: number): number {
  assertFinite(steps, "Standard steps");
  return steps * STANDARD_STEP_METERS;
}

export function metersToStandardSteps(meters: number): number {
  assertFinite(meters, "Meters");
  return meters / STANDARD_STEP_METERS;
}

export function yardsToStandardSteps(yards: number): number {
  assertFinite(yards, "Yards");
  return yards * STANDARD_STEPS_PER_YARD;
}

export function standardStepsToYards(steps: number): number {
  assertFinite(steps, "Standard steps");
  return steps * YARDS_PER_STANDARD_STEP;
}

export function feetToStandardSteps(feet: number): number {
  assertFinite(feet, "Feet");
  return feet * STANDARD_STEPS_PER_FOOT;
}

export function standardStepsToFeet(steps: number): number {
  assertFinite(steps, "Standard steps");
  return steps * FEET_PER_STANDARD_STEP;
}

/** Returns the signed X/Y displacement between two field points in steps. */
export function fieldPointDisplacementInStandardSteps(
  from: { xMeters: number; yMeters: number },
  to: { xMeters: number; yMeters: number },
): { xSteps: number; ySteps: number } {
  assertFiniteFieldPoint(from, "From point");
  assertFiniteFieldPoint(to, "To point");
  return {
    xSteps: metersToStandardSteps(to.xMeters - from.xMeters),
    ySteps: metersToStandardSteps(to.yMeters - from.yMeters),
  };
}
