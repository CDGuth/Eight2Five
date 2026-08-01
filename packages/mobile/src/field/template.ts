import {
  feetToMeters,
  metersToFeet,
  metersToYards,
  yardsToMeters,
} from "./units";
import type { FieldPoint } from "./types";

export type FieldLineKind =
  | "goal-line"
  | "sideline"
  | "hash-line"
  | "yard-line";

export interface FieldLine {
  readonly kind: FieldLineKind;
  readonly name: string;
  readonly axis: "x" | "y";
  readonly coordinateMeters: number;
  readonly start: FieldPoint;
  readonly end: FieldPoint;
  /** Absolute goal-to-goal yard coordinate, when the line has one. */
  readonly yardLineYards?: number;
}

export interface FieldYardNumber {
  readonly label: string;
  /** Side-relative number printed on the field (10, 20, 30, 40, or 50). */
  readonly yardLineYards: number;
  readonly xMeters: number;
  readonly yMeters: number;
  readonly side: "front" | "back";
  readonly widthMeters: number;
  readonly heightMeters: number;
}

export interface StandardHighSchoolFieldDimensions {
  readonly goalToGoalYards: 100;
  readonly widthYards: number;
  readonly goalToGoalMeters: number;
  readonly widthMeters: number;
  readonly fiveYardLineSpacingYards: 5;
  readonly fiveYardLineSpacingMeters: number;
  readonly highSchoolHashFromSidelineFeet: number;
  readonly highSchoolHashFromSidelineMeters: number;
  readonly yardNumberInsetFromSidelineFeet: number;
  readonly yardNumberInsetFromSidelineMeters: number;
  readonly yardNumberWidthFeet: number;
  readonly yardNumberHeightFeet: number;
  readonly yardNumberWidthMeters: number;
  readonly yardNumberHeightMeters: number;
}

export interface StandardHighSchoolFieldTemplate {
  readonly name: "standard-high-school";
  readonly dimensions: StandardHighSchoolFieldDimensions;
  readonly goalToGoalYards: 100;
  readonly widthYards: number;
  readonly goalToGoalMeters: number;
  readonly widthMeters: number;
  readonly bounds: {
    readonly minXMeters: 0;
    readonly maxXMeters: number;
    readonly minYMeters: 0;
    readonly maxYMeters: number;
  };
  readonly goalLines: readonly [FieldLine, FieldLine];
  readonly sidelines: readonly [FieldLine, FieldLine];
  readonly hashLines: readonly [FieldLine, FieldLine];
  readonly frontHashLine: FieldLine;
  readonly backHashLine: FieldLine;
  /** The 19 interior five-yard lines; goal lines are listed separately. */
  readonly fiveYardLines: readonly FieldLine[];
  /** The 21 multiples of five yards, including the two goal lines. */
  readonly allFiveYardLines: readonly FieldLine[];
  readonly yardLines: readonly FieldLine[];
  readonly yardNumbers: readonly FieldYardNumber[];
}

const FIELD_LENGTH_YARDS = 100 as const;
const FIELD_WIDTH_YARDS = 160 / 3;
const FIELD_LENGTH_METERS = yardsToMeters(FIELD_LENGTH_YARDS);
const FIELD_WIDTH_METERS = feetToMeters(160);
const HASH_FROM_SIDELINE_FEET = 53 + 4 / 12;
const HASH_FROM_SIDELINE_METERS = feetToMeters(HASH_FROM_SIDELINE_FEET);
const FRONT_HASH_Y_METERS = HASH_FROM_SIDELINE_METERS;
const BACK_HASH_Y_METERS = FIELD_WIDTH_METERS - HASH_FROM_SIDELINE_METERS;
const YARD_NUMBER_INSET_FEET = 12;
const YARD_NUMBER_INSET_METERS = feetToMeters(YARD_NUMBER_INSET_FEET);
const YARD_NUMBER_WIDTH_FEET = 4;
const YARD_NUMBER_HEIGHT_FEET = 6;
const YARD_NUMBER_WIDTH_METERS = feetToMeters(YARD_NUMBER_WIDTH_FEET);
const YARD_NUMBER_HEIGHT_METERS = feetToMeters(YARD_NUMBER_HEIGHT_FEET);

export const STANDARD_FIELD_LENGTH_YARDS = FIELD_LENGTH_YARDS;
export const STANDARD_FIELD_WIDTH_YARDS = FIELD_WIDTH_YARDS;
export const STANDARD_FIELD_LENGTH_METERS = FIELD_LENGTH_METERS;
export const STANDARD_FIELD_WIDTH_METERS = FIELD_WIDTH_METERS;
export const HIGH_SCHOOL_HASH_DISTANCE_FEET = HASH_FROM_SIDELINE_FEET;
export const HIGH_SCHOOL_HASH_DISTANCE_METERS = HASH_FROM_SIDELINE_METERS;

function point(xMeters: number, yMeters: number): FieldPoint {
  return Object.freeze({ xMeters, yMeters });
}

function xLine(kind: FieldLineKind, name: string, xYards: number): FieldLine {
  const xMeters = yardsToMeters(xYards);
  return Object.freeze({
    kind,
    name,
    axis: "x",
    coordinateMeters: xMeters,
    start: point(xMeters, 0),
    end: point(xMeters, FIELD_WIDTH_METERS),
    yardLineYards: xYards,
  });
}

function yLine(kind: FieldLineKind, name: string, yMeters: number): FieldLine {
  return Object.freeze({
    kind,
    name,
    axis: "y",
    coordinateMeters: yMeters,
    start: point(0, yMeters),
    end: point(FIELD_LENGTH_METERS, yMeters),
  });
}

function makeYardNumbers(): readonly FieldYardNumber[] {
  const numbers: FieldYardNumber[] = [];
  for (const absoluteYards of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
    const sideRelativeYards = Math.min(absoluteYards, 100 - absoluteYards);
    const label = String(sideRelativeYards);
    const xMeters = yardsToMeters(absoluteYards);
    for (const side of ["front", "back"] as const) {
      const yMeters =
        side === "front"
          ? YARD_NUMBER_INSET_METERS
          : FIELD_WIDTH_METERS - YARD_NUMBER_INSET_METERS;
      numbers.push(
        Object.freeze({
          label,
          yardLineYards: sideRelativeYards,
          xMeters,
          yMeters,
          side,
          widthMeters: YARD_NUMBER_WIDTH_METERS,
          heightMeters: YARD_NUMBER_HEIGHT_METERS,
        }),
      );
    }
  }
  return Object.freeze(numbers);
}

const goalLines = Object.freeze([
  xLine("goal-line", "Side 1 Goal Line", 0),
  xLine("goal-line", "Side 2 Goal Line", 100),
] as const);
const sidelines = Object.freeze([
  yLine("sideline", "Front Sideline", 0),
  yLine("sideline", "Back Sideline", FIELD_WIDTH_METERS),
] as const);
const hashLines = Object.freeze([
  yLine("hash-line", "HS FH", FRONT_HASH_Y_METERS),
  yLine("hash-line", "HS BH", BACK_HASH_Y_METERS),
] as const);
const fiveYardLines = Object.freeze(
  Array.from({ length: 19 }, (_, index) => {
    const yardLineYards = (index + 1) * 5;
    return xLine("yard-line", `${yardLineYards} yd Line`, yardLineYards);
  }),
);
const allFiveYardLines = Object.freeze([
  goalLines[0],
  ...fiveYardLines,
  goalLines[1],
]);

const dimensions: StandardHighSchoolFieldDimensions = Object.freeze({
  goalToGoalYards: FIELD_LENGTH_YARDS,
  widthYards: FIELD_WIDTH_YARDS,
  goalToGoalMeters: FIELD_LENGTH_METERS,
  widthMeters: FIELD_WIDTH_METERS,
  fiveYardLineSpacingYards: 5,
  fiveYardLineSpacingMeters: yardsToMeters(5),
  highSchoolHashFromSidelineFeet: HASH_FROM_SIDELINE_FEET,
  highSchoolHashFromSidelineMeters: HASH_FROM_SIDELINE_METERS,
  yardNumberInsetFromSidelineFeet: YARD_NUMBER_INSET_FEET,
  yardNumberInsetFromSidelineMeters: YARD_NUMBER_INSET_METERS,
  yardNumberWidthFeet: YARD_NUMBER_WIDTH_FEET,
  yardNumberHeightFeet: YARD_NUMBER_HEIGHT_FEET,
  yardNumberWidthMeters: YARD_NUMBER_WIDTH_METERS,
  yardNumberHeightMeters: YARD_NUMBER_HEIGHT_METERS,
});

/**
 * One shared, immutable geometry source for field conversion and future Skia
 * rendering. Coordinates deliberately remain meters even when labels are in
 * yards/feet so no display rounding leaks into domain calculations.
 */
export const STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE: StandardHighSchoolFieldTemplate =
  Object.freeze({
    name: "standard-high-school",
    dimensions,
    goalToGoalYards: FIELD_LENGTH_YARDS,
    widthYards: FIELD_WIDTH_YARDS,
    goalToGoalMeters: FIELD_LENGTH_METERS,
    widthMeters: FIELD_WIDTH_METERS,
    bounds: Object.freeze({
      minXMeters: 0,
      maxXMeters: FIELD_LENGTH_METERS,
      minYMeters: 0,
      maxYMeters: FIELD_WIDTH_METERS,
    }),
    goalLines,
    sidelines,
    hashLines,
    frontHashLine: hashLines[0],
    backHashLine: hashLines[1],
    fiveYardLines,
    allFiveYardLines,
    yardLines: fiveYardLines,
    yardNumbers: makeYardNumbers(),
  });

/** Short aliases used by drawing callers and older design notes. */
export const STANDARD_HIGH_SCHOOL_FIELD = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
export const STANDARD_FIELD_TEMPLATE = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;

/**
 * The template uses meters internally; this helper is useful when displaying
 * dimensions without duplicating conversion logic in a renderer.
 */
export function getStandardFieldDimensionsInFeet() {
  return Object.freeze({
    goalToGoalFeet: metersToFeet(FIELD_LENGTH_METERS),
    widthFeet: metersToFeet(FIELD_WIDTH_METERS),
    frontHashFromSidelineFeet: metersToFeet(FRONT_HASH_Y_METERS),
    backHashFromFrontSidelineFeet: metersToFeet(BACK_HASH_Y_METERS),
  });
}

export function getStandardFieldDimensionsInYards() {
  return Object.freeze({
    goalToGoalYards: metersToYards(FIELD_LENGTH_METERS),
    widthYards: metersToYards(FIELD_WIDTH_METERS),
    frontHashFromFrontSidelineYards: metersToYards(FRONT_HASH_Y_METERS),
    backHashFromFrontSidelineYards: metersToYards(BACK_HASH_Y_METERS),
  });
}
