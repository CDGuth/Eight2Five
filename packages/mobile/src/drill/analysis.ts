import type { DrillGridPoint } from "@eight2five/drill-schema";

import type { DrillSet } from "./types";

const POSITION_EPSILON_STEPS = 1e-9;
const NUMBER_EPSILON = 1e-8;
const STANDARD_STEPS_PER_FIVE_YARDS = 8;
const FIVE_YARD_GRID_LINES = Object.freeze(
  Array.from({ length: 21 }, (_, index) => -80 + index * 8),
);

export interface TransitionAnalysis {
  readonly distanceSteps: number;
  readonly stepSizeToFive?: number;
  readonly isHalt: boolean;
  readonly yardLineCrossingCounts: readonly number[];
}

function assertCounts(counts: number): void {
  if (!Number.isInteger(counts) || counts < 0) {
    throw new RangeError("Transition counts must be a non-negative integer.");
  }
}

function assertGridPoint(point: DrillGridPoint, name: string): void {
  if (!Number.isFinite(point.xSteps) || !Number.isFinite(point.ySteps)) {
    throw new RangeError(`${name} must contain finite xSteps and ySteps.`);
  }
}

function cleanNearHalf(value: number): number {
  const nearestHalf = Math.round(value * 2) / 2;
  if (Math.abs(value - nearestHalf) <= NUMBER_EPSILON) return nearestHalf;
  return Number(value.toFixed(6));
}

function roundToQuarter(value: number): number {
  return Number((Math.round(value * 4) / 4).toFixed(2));
}

function isSamePoint(start: DrillGridPoint, end: DrillGridPoint): boolean {
  return (
    Math.abs(start.xSteps - end.xSteps) <= POSITION_EPSILON_STEPS &&
    Math.abs(start.ySteps - end.ySteps) <= POSITION_EPSILON_STEPS
  );
}

function crossingCounts(
  start: DrillGridPoint,
  end: DrillGridPoint,
  counts: number,
): readonly number[] {
  const xDelta = end.xSteps - start.xSteps;
  if (Math.abs(xDelta) <= POSITION_EPSILON_STEPS || counts === 0) return [];

  return Object.freeze(
    FIVE_YARD_GRID_LINES.map((xSteps) => (xSteps - start.xSteps) / xDelta)
      .filter(
        (progress) =>
          progress > NUMBER_EPSILON && progress < 1 - NUMBER_EPSILON,
      )
      .sort((left, right) => left - right)
      .map((progress) => cleanNearHalf(progress * counts)),
  );
}

/**
 * Derives transition metrics from drill-grid positions and incoming counts.
 * Counts remain performer-facing metadata; these convenience metrics do
 * not create a musical timeline or persisted step-size field.
 */
export function analyzeTransition(
  previousPosition: DrillGridPoint | null | undefined,
  currentPosition: DrillGridPoint,
  countsFromPrevious: number,
): TransitionAnalysis {
  assertGridPoint(currentPosition, "Current position");
  assertCounts(countsFromPrevious);

  if (!previousPosition) {
    return Object.freeze({
      distanceSteps: 0,
      isHalt: false,
      yardLineCrossingCounts: Object.freeze([]),
    });
  }

  assertGridPoint(previousPosition, "Previous position");
  const distanceSteps = Math.hypot(
    currentPosition.xSteps - previousPosition.xSteps,
    currentPosition.ySteps - previousPosition.ySteps,
  );
  const isHalt =
    countsFromPrevious > 0 && isSamePoint(previousPosition, currentPosition);
  const stepSizeToFive =
    countsFromPrevious > 0 && distanceSteps > POSITION_EPSILON_STEPS
      ? roundToQuarter(
          (countsFromPrevious * STANDARD_STEPS_PER_FIVE_YARDS) / distanceSteps,
        )
      : undefined;

  return Object.freeze({
    distanceSteps: cleanNearHalf(distanceSteps),
    ...(stepSizeToFive === undefined ? {} : { stepSizeToFive }),
    isHalt,
    yardLineCrossingCounts: crossingCounts(
      previousPosition,
      currentPosition,
      countsFromPrevious,
    ),
  });
}

export function analyzeDrillTransition(
  previousSet: DrillSet | null | undefined,
  currentSet: DrillSet,
): TransitionAnalysis {
  return analyzeTransition(
    previousSet?.position,
    currentSet.position,
    currentSet.countsFromPrevious,
  );
}

export const calculateTransitionAnalysis = analyzeTransition;
