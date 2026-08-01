import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToFieldPoint,
  type FieldLateralReference,
  type FieldPoint,
  type MarchingCoordinate,
  type MarchingFrontBackRelation,
  type MarchingSideReference,
  type MarchingSideRelation,
} from "@eight2five/mobile/field";

export const PAGE_LABEL_MAX_LENGTH = 40;
export const YARD_LINES = Object.freeze(
  Array.from({ length: 11 }, (_, index) => index * 5),
);

export interface MarchingCoordinateDraft {
  readonly label: string;
  readonly countsFromPrevious: string;
  readonly side: "1" | "2" | "center";
  readonly yardLine: string;
  readonly sideRelation: MarchingSideRelation;
  readonly sideOffsetSteps: string;
  readonly frontBackReference: FieldLateralReference;
  readonly frontBackRelation: MarchingFrontBackRelation;
  readonly frontBackOffsetSteps: string;
}

export type PageFormField =
  | "label"
  | "countsFromPrevious"
  | "side"
  | "yardLine"
  | "sideOffsetSteps"
  | "frontBackOffsetSteps"
  | "coordinate";

export type PageFormErrors = Partial<Record<PageFormField, string>>;

export interface ValidatedPageDraft {
  readonly label: string;
  readonly countsFromPrevious: number;
  readonly position: FieldPoint;
  readonly coordinate: MarchingCoordinate;
}

export interface PageDraftValidation {
  readonly errors: PageFormErrors;
  readonly value?: ValidatedPageDraft;
}

export interface CoordinatePreview {
  readonly side: string;
  readonly frontBack: string;
}

export function createDefaultPageDraft({
  ordinal,
  suggestedLabel,
}: {
  ordinal: number;
  suggestedLabel: string;
}): MarchingCoordinateDraft {
  return {
    label: suggestedLabel,
    countsFromPrevious: ordinal === 0 ? "0" : "8",
    side: "center",
    yardLine: "50",
    sideRelation: "on",
    sideOffsetSteps: "0",
    frontBackReference: "front-sideline",
    frontBackRelation: "on",
    frontBackOffsetSteps: "0",
  };
}

export function pageToDraft(page: {
  readonly label: string;
  readonly countsFromPrevious: number;
  readonly position: FieldPoint;
}): MarchingCoordinateDraft {
  const coordinate = fieldPointToMarchingCoordinate(page.position);
  return {
    label: page.label,
    countsFromPrevious: String(page.countsFromPrevious),
    side: String(coordinate.side.side) as MarchingCoordinateDraft["side"],
    yardLine: String(coordinate.side.yardLine),
    sideRelation: coordinate.side.relation,
    sideOffsetSteps: String(coordinate.side.offsetSteps),
    frontBackReference: coordinate.frontBack.reference,
    frontBackRelation: coordinate.frontBack.relation,
    frontBackOffsetSteps: String(coordinate.frontBack.offsetSteps),
  };
}

export function validatePageDraft(
  draft: MarchingCoordinateDraft,
): PageDraftValidation {
  const errors: PageFormErrors = {};
  const label = draft.label.trim();
  if (!label) errors.label = "Enter a label.";
  else if (label.length > PAGE_LABEL_MAX_LENGTH) {
    errors.label = `Labels must be ${PAGE_LABEL_MAX_LENGTH} characters or fewer.`;
  }

  const counts = parseNonNegativeNumber(
    draft.countsFromPrevious,
    "Enter finite, non-negative counts.",
  );
  if (typeof counts === "string") errors.countsFromPrevious = counts;

  const coordinateResult = coordinateFromDraft(draft);
  Object.assign(errors, coordinateResult.errors);
  if (
    Object.keys(errors).length > 0 ||
    typeof counts === "string" ||
    !coordinateResult.coordinate ||
    !coordinateResult.position
  ) {
    return { errors };
  }

  return {
    errors,
    value: {
      label,
      countsFromPrevious: counts,
      coordinate: coordinateResult.coordinate,
      position: coordinateResult.position,
    },
  };
}

export function previewCoordinate(
  draft: MarchingCoordinateDraft,
): CoordinatePreview | undefined {
  const result = coordinateFromDraft(draft);
  if (!result.coordinate || Object.keys(result.errors).length > 0) {
    return undefined;
  }
  return {
    side: formatMarchingSide(result.coordinate.side),
    frontBack: formatMarchingFrontBack(result.coordinate.frontBack),
  };
}

function coordinateFromDraft(draft: MarchingCoordinateDraft): {
  readonly errors: PageFormErrors;
  readonly coordinate?: MarchingCoordinate;
  readonly position?: FieldPoint;
} {
  const errors: PageFormErrors = {};
  const yardLine = parseNonNegativeNumber(
    draft.yardLine,
    "Choose a five-yard line.",
  );
  if (typeof yardLine === "string" || !YARD_LINES.includes(yardLine)) {
    errors.yardLine = "Choose a five-yard line from 0 through 50.";
  }

  const sideOffset = parseNonNegativeNumber(
    draft.sideOffsetSteps,
    "Enter a finite, non-negative side offset.",
  );
  if (typeof sideOffset === "string") errors.sideOffsetSteps = sideOffset;

  const frontBackOffset = parseNonNegativeNumber(
    draft.frontBackOffsetSteps,
    "Enter a finite, non-negative front-to-back offset.",
  );
  if (typeof frontBackOffset === "string") {
    errors.frontBackOffsetSteps = frontBackOffset;
  }

  if (
    typeof yardLine === "string" ||
    typeof sideOffset === "string" ||
    typeof frontBackOffset === "string"
  ) {
    return { errors };
  }

  const side = parseSide(draft.side);
  if (side === undefined) {
    errors.side = "Choose Side 1, Side 2, or no side for the 50.";
    return { errors };
  }

  if (side === "center" && yardLine !== 50) {
    errors.side = "No side is available only when exactly on the 50-yard line.";
  }

  const normalizedSide = yardLine === 50 && sideOffset === 0 ? "center" : side;
  const normalizedSideRelation = sideOffset === 0 ? "on" : draft.sideRelation;
  if (
    yardLine === 50 &&
    normalizedSide !== "center" &&
    normalizedSideRelation !== "outside"
  ) {
    errors.coordinate =
      "An offset from the 50-yard line must be outside on Side 1 or Side 2.";
  }

  // The domain preserves arbitrary fractional steps, so validation never rounds
  // entered offsets; quarter-step values remain fully supported.
  const coordinate: MarchingCoordinate = {
    side: {
      side: normalizedSide,
      yardLine,
      relation: normalizedSide === "center" ? "on" : normalizedSideRelation,
      offsetSteps: normalizedSide === "center" ? 0 : sideOffset,
    },
    frontBack: {
      reference: draft.frontBackReference,
      relation: frontBackOffset === 0 ? "on" : draft.frontBackRelation,
      offsetSteps: frontBackOffset,
    },
  };

  if (Object.keys(errors).length > 0) return { errors, coordinate };
  try {
    const position = marchingCoordinateToFieldPoint(coordinate);
    if (!isInFieldBounds(position)) {
      errors.coordinate = "The coordinate must remain within the field bounds.";
      return { errors, coordinate };
    }
    return { errors, coordinate, position };
  } catch (cause) {
    errors.coordinate = cause instanceof Error ? cause.message : String(cause);
    return { errors, coordinate };
  }
}

function parseNonNegativeNumber(
  value: string,
  message: string,
): number | string {
  if (!value.trim()) return message;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : message;
}

function parseSide(
  value: MarchingCoordinateDraft["side"],
): MarchingSideReference | undefined {
  if (value === "1") return 1;
  if (value === "2") return 2;
  return value === "center" ? "center" : undefined;
}

function isInFieldBounds(point: FieldPoint): boolean {
  const { bounds } = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
  const epsilon = 1e-8;
  return (
    point.xMeters >= bounds.minXMeters - epsilon &&
    point.xMeters <= bounds.maxXMeters + epsilon &&
    point.yMeters >= bounds.minYMeters - epsilon &&
    point.yMeters <= bounds.maxYMeters + epsilon
  );
}
