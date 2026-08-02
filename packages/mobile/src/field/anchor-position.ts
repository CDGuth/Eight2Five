import {
  marchingCoordinateToFieldPoint,
  type MarchingCoordinate,
} from "./marching";
import { STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE } from "./template";
import type { AnchorFieldPosition, FieldPoint } from "./types";
import {
  feetToMeters,
  metersToFeet,
  metersToYards,
  yardsToMeters,
} from "./units";

export const ANCHOR_POSITION_UNITS = ["meters", "yards", "feet"] as const;
export type AnchorPositionUnit = (typeof ANCHOR_POSITION_UNITS)[number];

export const ANCHOR_POSITION_REFERENCES = [
  "center-field",
  "center-front-sideline",
  "center-back-sideline",
  "side-1-front-corner",
  "side-1-back-corner",
  "side-2-front-corner",
  "side-2-back-corner",
  "side-1-goal-line-center",
  "side-2-goal-line-center",
  "front-hash-center",
  "back-hash-center",
] as const;
export type AnchorPositionReference =
  (typeof ANCHOR_POSITION_REFERENCES)[number];

export const ANCHOR_POSITION_REFERENCE_LABELS: Readonly<
  Record<AnchorPositionReference, string>
> = Object.freeze({
  "center-field": "Center of field",
  "center-front-sideline": "Center of front sideline",
  "center-back-sideline": "Center of back sideline",
  "side-1-front-corner": "Side 1/front corner",
  "side-1-back-corner": "Side 1/back corner",
  "side-2-front-corner": "Side 2/front corner",
  "side-2-back-corner": "Side 2/back corner",
  "side-1-goal-line-center": "Side 1 goal-line center",
  "side-2-goal-line-center": "Side 2 goal-line center",
  "front-hash-center": "Front-hash center",
  "back-hash-center": "Back-hash center",
});

export interface StandardAnchorPositionInput {
  readonly reference: AnchorPositionReference;
  readonly unit: AnchorPositionUnit;
  /** Negative is toward Side 1; positive is toward Side 2. */
  readonly sideToSideOffset: number;
  /** Negative is toward the front sideline; positive is toward the back. */
  readonly frontToBackOffset: number;
  readonly height: number;
}

export interface StandardAnchorPositionDraft {
  readonly reference: AnchorPositionReference;
  readonly unit: AnchorPositionUnit;
  readonly sideToSideOffset: string;
  readonly frontToBackOffset: string;
  readonly height: string;
}

export type AnchorPositionDraftField =
  | "sideToSideOffset"
  | "frontToBackOffset"
  | "height"
  | "position";
export type AnchorPositionDraftErrors = Partial<
  Record<AnchorPositionDraftField, string>
>;

export interface ParsedAnchorPositionDraft {
  readonly errors: AnchorPositionDraftErrors;
  readonly value?: AnchorFieldPosition;
}

export const MAX_ANCHOR_HEIGHT_METERS = 100;

const template = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
const bounds = template.bounds;
const centerXMeters = (bounds.minXMeters + bounds.maxXMeters) / 2;
const centerYMeters = (bounds.minYMeters + bounds.maxYMeters) / 2;
const point = (xMeters: number, yMeters: number): FieldPoint => ({
  xMeters,
  yMeters,
});

export const ANCHOR_POSITION_REFERENCE_POINTS: Readonly<
  Record<AnchorPositionReference, FieldPoint>
> = Object.freeze({
  "center-field": point(centerXMeters, centerYMeters),
  "center-front-sideline": point(centerXMeters, bounds.minYMeters),
  "center-back-sideline": point(centerXMeters, bounds.maxYMeters),
  "side-1-front-corner": point(bounds.minXMeters, bounds.minYMeters),
  "side-1-back-corner": point(bounds.minXMeters, bounds.maxYMeters),
  "side-2-front-corner": point(bounds.maxXMeters, bounds.minYMeters),
  "side-2-back-corner": point(bounds.maxXMeters, bounds.maxYMeters),
  "side-1-goal-line-center": point(bounds.minXMeters, centerYMeters),
  "side-2-goal-line-center": point(bounds.maxXMeters, centerYMeters),
  "front-hash-center": point(
    centerXMeters,
    template.frontHashLine.coordinateMeters,
  ),
  "back-hash-center": point(
    centerXMeters,
    template.backHashLine.coordinateMeters,
  ),
});

export function getAnchorPositionReferencePoint(
  reference: AnchorPositionReference,
): FieldPoint {
  return ANCHOR_POSITION_REFERENCE_POINTS[reference];
}

export function anchorPositionUnitsToMeters(
  value: number,
  unit: AnchorPositionUnit,
): number {
  assertFinite(value, "Anchor position value");
  if (unit === "yards") return yardsToMeters(value);
  if (unit === "feet") return feetToMeters(value);
  return value;
}

export function metersToAnchorPositionUnits(
  value: number,
  unit: AnchorPositionUnit,
): number {
  assertFinite(value, "Anchor position value");
  if (unit === "yards") return metersToYards(value);
  if (unit === "feet") return metersToFeet(value);
  return value;
}

export function convertAnchorPositionUnits(
  value: number,
  from: AnchorPositionUnit,
  to: AnchorPositionUnit,
): number {
  return metersToAnchorPositionUnits(
    anchorPositionUnitsToMeters(value, from),
    to,
  );
}

export function anchorFieldPositionFromStandard(
  input: StandardAnchorPositionInput,
): AnchorFieldPosition {
  const reference = getAnchorPositionReferencePoint(input.reference);
  const position = {
    xMeters:
      reference.xMeters +
      anchorPositionUnitsToMeters(input.sideToSideOffset, input.unit),
    yMeters:
      reference.yMeters +
      anchorPositionUnitsToMeters(input.frontToBackOffset, input.unit),
    zMeters: anchorPositionUnitsToMeters(input.height, input.unit),
  };
  assertValidAnchorFieldPosition(position);
  return position;
}

export function anchorFieldPositionToStandard(
  position: AnchorFieldPosition,
  reference: AnchorPositionReference,
  unit: AnchorPositionUnit,
): StandardAnchorPositionInput {
  assertValidAnchorFieldPosition(position);
  const origin = getAnchorPositionReferencePoint(reference);
  return {
    reference,
    unit,
    sideToSideOffset: metersToAnchorPositionUnits(
      position.xMeters - origin.xMeters,
      unit,
    ),
    frontToBackOffset: metersToAnchorPositionUnits(
      position.yMeters - origin.yMeters,
      unit,
    ),
    height: metersToAnchorPositionUnits(position.zMeters, unit),
  };
}

export function anchorFieldPositionFromMarchingCoordinate(
  coordinate: MarchingCoordinate,
  heightMeters: number,
): AnchorFieldPosition {
  const position = {
    ...marchingCoordinateToFieldPoint(coordinate),
    zMeters: heightMeters,
  };
  assertValidAnchorFieldPosition(position);
  return position;
}

export function parseAnchorPositionDraft(
  draft: StandardAnchorPositionDraft,
): ParsedAnchorPositionDraft {
  const errors: AnchorPositionDraftErrors = {};
  const sideToSideOffset = parseFiniteDraftNumber(
    draft.sideToSideOffset,
    "Enter a finite side-to-side offset.",
    errors,
    "sideToSideOffset",
  );
  const frontToBackOffset = parseFiniteDraftNumber(
    draft.frontToBackOffset,
    "Enter a finite front-to-back offset.",
    errors,
    "frontToBackOffset",
  );
  const height = parseFiniteDraftNumber(
    draft.height,
    "Enter a finite height.",
    errors,
    "height",
  );
  if (height !== undefined && height < 0) {
    errors.height = "Height cannot be negative.";
  }
  if (
    sideToSideOffset === undefined ||
    frontToBackOffset === undefined ||
    height === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { errors };
  }
  try {
    return {
      errors,
      value: anchorFieldPositionFromStandard({
        reference: draft.reference,
        unit: draft.unit,
        sideToSideOffset,
        frontToBackOffset,
        height,
      }),
    };
  } catch (cause) {
    return {
      errors: {
        ...errors,
        position: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
}

export function validateAnchorFieldPosition(
  position: unknown,
): AnchorPositionDraftErrors {
  if (!position || typeof position !== "object") {
    return { position: "Anchor field position is required." };
  }
  const value = position as Partial<AnchorFieldPosition>;
  if (
    !Number.isFinite(value.xMeters) ||
    !Number.isFinite(value.yMeters) ||
    !Number.isFinite(value.zMeters)
  ) {
    return { position: "Anchor coordinates must be finite." };
  }
  if (
    value.xMeters! < bounds.minXMeters ||
    value.xMeters! > bounds.maxXMeters ||
    value.yMeters! < bounds.minYMeters ||
    value.yMeters! > bounds.maxYMeters
  ) {
    return {
      position: "Anchor coordinates must be within the standard field bounds.",
    };
  }
  if (value.zMeters! < 0) {
    return { position: "Anchor height cannot be negative." };
  }
  if (value.zMeters! > MAX_ANCHOR_HEIGHT_METERS) {
    return {
      position: `Anchor height must be at most ${MAX_ANCHOR_HEIGHT_METERS} meters.`,
    };
  }
  return {};
}

export function assertValidAnchorFieldPosition(
  position: unknown,
): asserts position is AnchorFieldPosition {
  const message = validateAnchorFieldPosition(position).position;
  if (message) throw new RangeError(message);
}

function parseFiniteDraftNumber(
  input: string,
  message: string,
  errors: AnchorPositionDraftErrors,
  field: AnchorPositionDraftField,
): number | undefined {
  if (!input.trim()) {
    errors[field] = message;
    return undefined;
  }
  const value = Number(input);
  if (!Number.isFinite(value)) {
    errors[field] = message;
    return undefined;
  }
  return value;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}
