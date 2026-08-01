import { assertFiniteFieldPoint, type FieldPoint } from "../field/types";
import {
  metersToStandardSteps,
  STANDARD_STEPS_PER_FIVE_YARDS,
} from "../field/units";
import { STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE } from "../field/template";
import type { DrillPage } from "./types";

const POSITION_EPSILON_METERS = 1e-9;
const NUMBER_EPSILON = 1e-8;

export interface TransitionAnalysis {
  readonly distanceSteps: number;
  readonly stepSizeToFive?: number;
  readonly isHalt: boolean;
  readonly yardLineCrossingCounts: readonly number[];
}

function assertCounts(counts: number): void {
  if (!Number.isFinite(counts) || counts < 0) {
    throw new RangeError(
      "Transition counts must be a finite non-negative number.",
    );
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

function isSamePoint(start: FieldPoint, end: FieldPoint): boolean {
  return (
    Math.abs(start.xMeters - end.xMeters) <= POSITION_EPSILON_METERS &&
    Math.abs(start.yMeters - end.yMeters) <= POSITION_EPSILON_METERS
  );
}

function crossingCounts(
  start: FieldPoint,
  end: FieldPoint,
  counts: number,
): readonly number[] {
  const xDelta = end.xMeters - start.xMeters;
  if (Math.abs(xDelta) <= POSITION_EPSILON_METERS || counts === 0) return [];

  const crossings = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE.allFiveYardLines
    .map((line) => (line.coordinateMeters - start.xMeters) / xDelta)
    .filter(
      (progress) => progress > NUMBER_EPSILON && progress < 1 - NUMBER_EPSILON,
    )
    .sort((left, right) => left - right)
    .map((progress) => cleanNearHalf(progress * counts));

  return Object.freeze(crossings);
}

/**
 * Derives all transition metrics from canonical points and counts. These
 * values are intentionally never fields on DrillPage or persisted records.
 */
export function analyzeTransition(
  previousPosition: FieldPoint | null | undefined,
  currentPosition: FieldPoint,
  countsFromPrevious: number,
): TransitionAnalysis {
  assertFiniteFieldPoint(currentPosition, "Current position");
  assertCounts(countsFromPrevious);

  if (!previousPosition) {
    return Object.freeze({
      distanceSteps: 0,
      isHalt: false,
      yardLineCrossingCounts: Object.freeze([]),
    });
  }

  assertFiniteFieldPoint(previousPosition, "Previous position");
  const distanceSteps = metersToStandardSteps(
    Math.hypot(
      currentPosition.xMeters - previousPosition.xMeters,
      currentPosition.yMeters - previousPosition.yMeters,
    ),
  );
  const isHalt =
    countsFromPrevious > 0 && isSamePoint(previousPosition, currentPosition);
  const stepSizeToFive =
    countsFromPrevious > 0 && distanceSteps > POSITION_EPSILON_METERS
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
  previousPage: DrillPage | null | undefined,
  currentPage: DrillPage,
): TransitionAnalysis {
  return analyzeTransition(
    previousPage?.position,
    currentPage.position,
    currentPage.countsFromPrevious,
  );
}

export const calculateTransitionAnalysis = analyzeTransition;
