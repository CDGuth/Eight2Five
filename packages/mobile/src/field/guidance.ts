import { assertFiniteFieldPoint, type FieldPoint } from "./types";
import {
  fieldPointDisplacementInStandardSteps,
  metersToStandardSteps,
} from "./units";
import { formatMarchingSteps } from "./marching";

export interface FieldGuidance {
  /** Straight-line horizontal distance, in standard 8-to-5 steps. */
  readonly distanceSteps: number;
  /** Signed target-minus-current displacement along canonical X/Y axes. */
  readonly xDisplacementSteps: number;
  readonly yDisplacementSteps: number;
  readonly xLabel: string;
  readonly yLabel: string;
}

function formatGuidanceAxis(
  steps: number,
  negativeDirection: string,
  positiveDirection: string,
): string {
  if (Math.abs(steps) < 1e-9) return "0 steps";
  const direction = steps < 0 ? negativeDirection : positiveDirection;
  const magnitude = formatMarchingSteps(Math.abs(steps));
  const word = Number(magnitude) === 1 ? "step" : "steps";
  return `${magnitude} ${word} toward ${direction}`;
}

/**
 * Produces field-relative guidance only. It deliberately does not use device
 * heading, phone orientation, compass data, or any other view-dependent input.
 */
export function calculateFieldGuidance(
  current: FieldPoint,
  target: FieldPoint,
): FieldGuidance {
  assertFiniteFieldPoint(current, "Current point");
  assertFiniteFieldPoint(target, "Target point");
  const { xSteps, ySteps } = fieldPointDisplacementInStandardSteps(
    current,
    target,
  );
  const xMeters = target.xMeters - current.xMeters;
  const yMeters = target.yMeters - current.yMeters;
  const distanceSteps = metersToStandardSteps(Math.hypot(xMeters, yMeters));
  return Object.freeze({
    distanceSteps,
    xDisplacementSteps: xSteps,
    yDisplacementSteps: ySteps,
    xLabel: formatGuidanceAxis(xSteps, "Side 1", "Side 2"),
    yLabel: formatGuidanceAxis(
      ySteps,
      "the front sideline",
      "the back sideline",
    ),
  });
}

export const getFieldGuidance = calculateFieldGuidance;
export const calculateGuidance = calculateFieldGuidance;
export const getMovementGuidance = calculateFieldGuidance;
