import { assertFiniteFieldPoint, type FieldPoint } from "./types";
import {
  fieldPointToDrillGridPoint,
  formatMarchingSteps,
  type MarchingFieldInput,
} from "./marching";

export interface FieldGuidance {
  /** Straight-line distance in the active field's marching-grid coordinates. */
  readonly distanceSteps: number;
  /** Signed target-minus-current displacement along canonical grid X/Y axes. */
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
 * Produces field-relative guidance in the active marching coordinate system.
 * Physical meters are projected through the field definition first so an NFHS
 * sideline-to-sideline move is exactly 84 grid steps rather than 85 1/3 literal
 * 22.5-inch intervals.
 */
export function calculateFieldGuidance(
  current: FieldPoint,
  target: FieldPoint,
  field?: MarchingFieldInput,
): FieldGuidance {
  assertFiniteFieldPoint(current, "Current point");
  assertFiniteFieldPoint(target, "Target point");
  const currentGrid = fieldPointToDrillGridPoint(current, field);
  const targetGrid = fieldPointToDrillGridPoint(target, field);
  const xSteps = targetGrid.xSteps - currentGrid.xSteps;
  const ySteps = targetGrid.ySteps - currentGrid.ySteps;
  return Object.freeze({
    distanceSteps: Math.hypot(xSteps, ySteps),
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
