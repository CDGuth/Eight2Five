import {
  getFieldPreset,
  type FieldMarkingDefinition,
  type FieldPresetId,
  type ResolvedFieldDefinition,
} from "@eight2five/drill-schema";

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
  /** Signed yards from the 50, when the line has a longitudinal coordinate. */
  readonly yardLineYards?: number;
}

export interface FieldYardNumber {
  readonly label: string;
  /** Side-relative number printed on the field (0, 10, 20, 30, 40, or 50). */
  readonly yardLineYards: number;
  readonly xMeters: number;
  readonly yMeters: number;
  readonly side: "front" | "back";
  /** Reference width only; rendering preserves the font's natural aspect ratio. */
  readonly widthMeters: number;
  readonly heightMeters: number;
}

export interface StandardFootballFieldDimensions {
  readonly goalToGoalYards: 100;
  readonly widthYards: number;
  readonly goalToGoalMeters: number;
  readonly widthMeters: number;
  readonly fiveYardLineSpacingYards: 5;
  readonly fiveYardLineSpacingMeters: number;
  readonly hashFromSidelineFeet: number;
  readonly hashFromSidelineMeters: number;
  /** @deprecated Use hashFromSidelineFeet. */
  readonly highSchoolHashFromSidelineFeet: number;
  /** @deprecated Use hashFromSidelineMeters. */
  readonly highSchoolHashFromSidelineMeters: number;
  readonly yardNumberCenterFromFrontSidelineFeet: number;
  readonly yardNumberCenterFromFrontSidelineMeters: number;
  readonly yardNumberCenterFromBackSidelineFeet: number;
  readonly yardNumberCenterFromBackSidelineMeters: number;
  /** @deprecated Use yardNumberCenterFromFrontSidelineFeet. */
  readonly yardNumberInsetFromSidelineFeet: number;
  /** @deprecated Use yardNumberCenterFromFrontSidelineMeters. */
  readonly yardNumberInsetFromSidelineMeters: number;
  readonly yardNumberWidthFeet: number;
  readonly yardNumberHeightFeet: number;
  readonly yardNumberWidthMeters: number;
  readonly yardNumberHeightMeters: number;
}

/** @deprecated Use StandardFootballFieldDimensions. */
export type StandardHighSchoolFieldDimensions = StandardFootballFieldDimensions;

export interface StandardFootballFieldTemplate {
  readonly name: "standard-football";
  readonly fieldPreset: FieldPresetId;
  readonly fieldDefinition: ResolvedFieldDefinition;
  readonly dimensions: StandardFootballFieldDimensions;
  readonly goalToGoalYards: 100;
  readonly widthYards: number;
  readonly goalToGoalMeters: number;
  readonly widthMeters: number;
  readonly bounds: {
    readonly minXMeters: number;
    readonly maxXMeters: number;
    readonly minYMeters: number;
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

/** @deprecated Use StandardFootballFieldTemplate. */
export type StandardHighSchoolFieldTemplate = StandardFootballFieldTemplate;

const FIELD_LENGTH_YARDS = 100 as const;
const FIELD_WIDTH_YARDS = 160 / 3;
const FIELD_LENGTH_METERS = yardsToMeters(FIELD_LENGTH_YARDS);
const FIELD_WIDTH_METERS = feetToMeters(160);

export const STANDARD_FIELD_LENGTH_YARDS = FIELD_LENGTH_YARDS;
export const STANDARD_FIELD_WIDTH_YARDS = FIELD_WIDTH_YARDS;
export const STANDARD_FIELD_LENGTH_METERS = FIELD_LENGTH_METERS;
export const STANDARD_FIELD_WIDTH_METERS = FIELD_WIDTH_METERS;
export const HIGH_SCHOOL_HASH_DISTANCE_FEET = 53 + 4 / 12;
export const HIGH_SCHOOL_HASH_DISTANCE_METERS = feetToMeters(
  HIGH_SCHOOL_HASH_DISTANCE_FEET,
);

const TEMPLATE_CACHE = new Map<FieldPresetId, StandardFootballFieldTemplate>();

function point(xMeters: number, yMeters: number): FieldPoint {
  return Object.freeze({ xMeters, yMeters });
}

function findReference(field: ResolvedFieldDefinition, id: string): number {
  const reference = field.physicalGeometry.referenceLines.find(
    (line) => line.id === id,
  );
  if (!reference) throw new RangeError(`Field preset is missing ${id}.`);
  return reference.coordinateMeters;
}

function xLine(
  bounds: StandardFootballFieldTemplate["bounds"],
  kind: FieldLineKind,
  name: string,
  signedYardsFromCenter: number,
): FieldLine {
  const xMeters = yardsToMeters(signedYardsFromCenter);
  return Object.freeze({
    kind,
    name,
    axis: "x",
    coordinateMeters: xMeters,
    start: point(xMeters, bounds.minYMeters),
    end: point(xMeters, bounds.maxYMeters),
    yardLineYards: signedYardsFromCenter,
  });
}

function yLine(
  bounds: StandardFootballFieldTemplate["bounds"],
  kind: FieldLineKind,
  name: string,
  yMeters: number,
): FieldLine {
  return Object.freeze({
    kind,
    name,
    axis: "y",
    coordinateMeters: yMeters,
    start: point(bounds.minXMeters, yMeters),
    end: point(bounds.maxXMeters, yMeters),
  });
}

function makeYardNumbers(
  bounds: StandardFootballFieldTemplate["bounds"],
  markings: FieldMarkingDefinition,
): readonly FieldYardNumber[] {
  const numbers: FieldYardNumber[] = [];
  for (const xYards of [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50]) {
    const sideRelativeYards = xYards === 0 ? 50 : 50 - Math.abs(xYards);
    const label = String(sideRelativeYards);
    const xMeters = yardsToMeters(xYards);
    for (const side of ["front", "back"] as const) {
      const yMeters =
        side === "front"
          ? bounds.minYMeters +
            markings.yardNumbers.centerFromFrontSidelineMeters
          : bounds.maxYMeters -
            markings.yardNumbers.centerFromBackSidelineMeters;
      numbers.push(
        Object.freeze({
          label,
          yardLineYards: sideRelativeYards,
          xMeters,
          yMeters,
          side,
          widthMeters: markings.yardNumbers.nominalWidthMeters,
          heightMeters: markings.yardNumbers.heightMeters,
        }),
      );
    }
  }
  return Object.freeze(numbers);
}

function hashPrefix(fieldPreset: FieldPresetId): string {
  switch (fieldPreset) {
    case "football-nfhs":
      return "HS";
    case "football-ncaa":
      return "NCAA";
    case "football-texas-uil":
      return "UIL";
    case "football-nfl":
      return "NFL";
  }
}

export function createStandardFootballFieldTemplate(
  fieldPreset: FieldPresetId,
): StandardFootballFieldTemplate {
  const cached = TEMPLATE_CACHE.get(fieldPreset);
  if (cached) return cached;

  const fieldDefinition = getFieldPreset(fieldPreset);
  const physicalBounds = fieldDefinition.physicalGeometry.bounds;
  const bounds = Object.freeze({
    minXMeters: physicalBounds.minXMeters,
    maxXMeters: physicalBounds.maxXMeters,
    minYMeters: physicalBounds.minYMeters,
    maxYMeters: physicalBounds.maxYMeters,
  });
  const frontHashMeters = findReference(fieldDefinition, "front-hash");
  const backHashMeters = findReference(fieldDefinition, "back-hash");
  const frontHashFromSidelineMeters = frontHashMeters - bounds.minYMeters;
  const markings = fieldDefinition.markings;
  const prefix = hashPrefix(fieldPreset);

  const goalLines = Object.freeze([
    xLine(bounds, "goal-line", "Side 1 Goal Line", -50),
    xLine(bounds, "goal-line", "Side 2 Goal Line", 50),
  ] as const);
  const sidelines = Object.freeze([
    yLine(bounds, "sideline", "Front Sideline", bounds.minYMeters),
    yLine(bounds, "sideline", "Back Sideline", bounds.maxYMeters),
  ] as const);
  const hashLines = Object.freeze([
    yLine(bounds, "hash-line", `${prefix} FH`, frontHashMeters),
    yLine(bounds, "hash-line", `${prefix} BH`, backHashMeters),
  ] as const);
  const fiveYardLines = Object.freeze(
    Array.from({ length: 19 }, (_, index) => {
      const signedYards = -45 + index * 5;
      const side = signedYards < 0 ? "Side 1" : signedYards > 0 ? "Side 2" : "";
      const labelYards = signedYards === 0 ? 50 : 50 - Math.abs(signedYards);
      return xLine(
        bounds,
        "yard-line",
        signedYards === 0 ? "50 yd Line" : `${side} ${labelYards} yd Line`,
        signedYards,
      );
    }),
  );
  const allFiveYardLines = Object.freeze([
    goalLines[0],
    ...fiveYardLines,
    goalLines[1],
  ]);
  const widthMeters = bounds.maxYMeters - bounds.minYMeters;
  const goalToGoalMeters = bounds.maxXMeters - bounds.minXMeters;
  const dimensions: StandardFootballFieldDimensions = Object.freeze({
    goalToGoalYards: FIELD_LENGTH_YARDS,
    widthYards: metersToYards(widthMeters),
    goalToGoalMeters,
    widthMeters,
    fiveYardLineSpacingYards: 5,
    fiveYardLineSpacingMeters: yardsToMeters(5),
    hashFromSidelineFeet: metersToFeet(frontHashFromSidelineMeters),
    hashFromSidelineMeters: frontHashFromSidelineMeters,
    highSchoolHashFromSidelineFeet: metersToFeet(frontHashFromSidelineMeters),
    highSchoolHashFromSidelineMeters: frontHashFromSidelineMeters,
    yardNumberCenterFromFrontSidelineFeet: metersToFeet(
      markings.yardNumbers.centerFromFrontSidelineMeters,
    ),
    yardNumberCenterFromFrontSidelineMeters:
      markings.yardNumbers.centerFromFrontSidelineMeters,
    yardNumberCenterFromBackSidelineFeet: metersToFeet(
      markings.yardNumbers.centerFromBackSidelineMeters,
    ),
    yardNumberCenterFromBackSidelineMeters:
      markings.yardNumbers.centerFromBackSidelineMeters,
    yardNumberInsetFromSidelineFeet: metersToFeet(
      markings.yardNumbers.centerFromFrontSidelineMeters,
    ),
    yardNumberInsetFromSidelineMeters:
      markings.yardNumbers.centerFromFrontSidelineMeters,
    yardNumberWidthFeet: metersToFeet(markings.yardNumbers.nominalWidthMeters),
    yardNumberHeightFeet: metersToFeet(markings.yardNumbers.heightMeters),
    yardNumberWidthMeters: markings.yardNumbers.nominalWidthMeters,
    yardNumberHeightMeters: markings.yardNumbers.heightMeters,
  });

  const template: StandardFootballFieldTemplate = Object.freeze({
    name: "standard-football",
    fieldPreset,
    fieldDefinition,
    dimensions,
    goalToGoalYards: FIELD_LENGTH_YARDS,
    widthYards: metersToYards(widthMeters),
    goalToGoalMeters,
    widthMeters,
    bounds,
    goalLines,
    sidelines,
    hashLines,
    frontHashLine: hashLines[0],
    backHashLine: hashLines[1],
    fiveYardLines,
    allFiveYardLines,
    yardLines: fiveYardLines,
    yardNumbers: makeYardNumbers(bounds, markings),
  });
  TEMPLATE_CACHE.set(fieldPreset, template);
  return template;
}

/** Exact NFHS physical geometry plus its conventional 160 x 84 marching grid. */
export const STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE =
  createStandardFootballFieldTemplate("football-nfhs");

export const STANDARD_HIGH_SCHOOL_FIELD = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
export const STANDARD_FIELD_TEMPLATE = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;

export function getStandardFieldDimensionsInFeet() {
  const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
  return Object.freeze({
    goalToGoalFeet: metersToFeet(field.goalToGoalMeters),
    widthFeet: metersToFeet(field.widthMeters),
    frontHashFromSidelineFeet: metersToFeet(
      field.frontHashLine.coordinateMeters - field.bounds.minYMeters,
    ),
    backHashFromFrontSidelineFeet: metersToFeet(
      field.backHashLine.coordinateMeters - field.bounds.minYMeters,
    ),
  });
}

export function getStandardFieldDimensionsInYards() {
  const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
  return Object.freeze({
    goalToGoalYards: metersToYards(field.goalToGoalMeters),
    widthYards: metersToYards(field.widthMeters),
    frontHashFromFrontSidelineYards: metersToYards(
      field.frontHashLine.coordinateMeters - field.bounds.minYMeters,
    ),
    backHashFromFrontSidelineYards: metersToYards(
      field.backHashLine.coordinateMeters - field.bounds.minYMeters,
    ),
  });
}
