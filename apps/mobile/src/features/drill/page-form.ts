import {
  drillGridPointToMarchingCoordinate,
  fieldPointToDrillGridPoint,
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToDrillGridPoint,
  type FieldLateralReference,
  type MarchingCoordinate,
  type MarchingFrontBackRelation,
  type MarchingSideReference,
  type MarchingSideRelation,
} from "@eight2five/mobile/field";
import type {
  DrillGridPoint,
  DrillSet,
  MeasureRange,
  SetKind,
} from "@eight2five/mobile/drill";

export const YARD_LINES = Object.freeze(
  Array.from({ length: 11 }, (_, index) => index * 5),
);

export interface MarchingCoordinateDraft {
  readonly setNumber: string;
  readonly setKind: SetKind;
  readonly setSuffix: string;
  readonly countsFromPrevious: string;
  readonly measureStart: string;
  readonly measureEnd: string;
  readonly side: "1" | "2" | "center";
  readonly yardLine: string;
  readonly sideRelation: MarchingSideRelation;
  readonly sideOffsetSteps: string;
  readonly frontBackReference: FieldLateralReference;
  readonly frontBackRelation: MarchingFrontBackRelation;
  readonly frontBackOffsetSteps: string;
}

export type SetFormField =
  | "setNumber"
  | "setSuffix"
  | "countsFromPrevious"
  | "measureStart"
  | "measureEnd"
  | "side"
  | "yardLine"
  | "sideOffsetSteps"
  | "frontBackOffsetSteps"
  | "coordinate";

export type SetFormErrors = Partial<Record<SetFormField, string>>;

export interface ValidatedSetDraft {
  readonly number: number;
  readonly kind: SetKind;
  readonly suffix?: string;
  readonly countsFromPrevious: number;
  readonly measureRange?: MeasureRange;
  readonly position: DrillGridPoint;
  readonly coordinate: MarchingCoordinate;
}

export interface SetDraftValidation {
  readonly errors: SetFormErrors;
  readonly value?: ValidatedSetDraft;
}

export interface CoordinatePreview {
  readonly side: string;
  readonly frontBack: string;
}

export function createDefaultPageDraft({
  ordinal,
  suggestedNumber,
  suggestedLabel,
}: {
  ordinal: number;
  suggestedNumber?: number;
  /** @deprecated Legacy callers may still pass a numeric-ish label. */
  suggestedLabel?: string;
}): MarchingCoordinateDraft {
  const fallbackNumber = Number(suggestedLabel);
  const resolvedNumber =
    suggestedNumber ??
    (Number.isSafeInteger(fallbackNumber) && fallbackNumber >= 0
      ? fallbackNumber
      : ordinal + 1);
  return {
    setNumber: String(resolvedNumber),
    setKind: "set",
    setSuffix: "",
    countsFromPrevious: ordinal === 0 ? "0" : "8",
    measureStart: "",
    measureEnd: "",
    side: "center",
    yardLine: "50",
    sideRelation: "on",
    sideOffsetSteps: "0",
    frontBackReference: "front-sideline",
    frontBackRelation: "on",
    frontBackOffsetSteps: "0",
  };
}

export function pageToDraft(set: DrillSet): MarchingCoordinateDraft {
  return setDraftFromPosition(set.position, {
    number: set.number,
    kind: set.kind,
    suffix: set.suffix,
    countsFromPrevious: set.countsFromPrevious,
    measureRange: set.measureRange,
  });
}

export function coordinateDraftFromFieldPoint(position: {
  readonly xMeters: number;
  readonly yMeters: number;
}): MarchingCoordinateDraft {
  return setDraftFromPosition(fieldPointToDrillGridPoint(position), {
    number: 0,
    kind: "set",
    countsFromPrevious: 0,
  });
}

function setDraftFromPosition(
  position: DrillGridPoint,
  details: {
    readonly number: number;
    readonly kind: SetKind;
    readonly suffix?: string;
    readonly countsFromPrevious: number;
    readonly measureRange?: MeasureRange;
  },
): MarchingCoordinateDraft {
  const coordinate = drillGridPointToMarchingCoordinate(position);
  return {
    setNumber: String(details.number),
    setKind: details.kind,
    setSuffix: details.suffix ?? "",
    countsFromPrevious: String(details.countsFromPrevious),
    measureStart: details.measureRange
      ? String(details.measureRange.start)
      : "",
    measureEnd: details.measureRange ? String(details.measureRange.end) : "",
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
): SetDraftValidation {
  const errors: SetFormErrors = {};
  const setNumber = parseNonNegativeInteger(
    draft.setNumber,
    "Enter a non-negative set number.",
  );
  if (typeof setNumber === "string") errors.setNumber = setNumber;

  const suffix = draft.setSuffix.trim();
  if (draft.setKind === "set" && suffix) {
    errors.setSuffix = "Primary sets do not have a suffix.";
  } else if (
    draft.setKind === "subset" &&
    !/^(?:[A-Z]|\.[0-9]+)$/.test(suffix)
  ) {
    errors.setSuffix = "Use one capital letter or a decimal suffix such as .5.";
  }

  const counts = parseNonNegativeInteger(
    draft.countsFromPrevious,
    "Enter non-negative whole-number counts.",
  );
  if (typeof counts === "string") errors.countsFromPrevious = counts;

  const measureRange = parseMeasureRange(draft, errors);
  const coordinateResult = coordinateFromDraft(draft);
  Object.assign(errors, coordinateResult.errors);
  if (
    Object.keys(errors).length > 0 ||
    typeof setNumber === "string" ||
    typeof counts === "string" ||
    !coordinateResult.coordinate ||
    !coordinateResult.position
  ) {
    return { errors };
  }

  return {
    errors,
    value: {
      number: setNumber,
      kind: draft.setKind,
      ...(draft.setKind === "subset" ? { suffix } : {}),
      countsFromPrevious: counts,
      ...(measureRange ? { measureRange } : {}),
      coordinate: coordinateResult.coordinate,
      position: coordinateResult.position,
    },
  };
}

export function previewCoordinate(
  draft: MarchingCoordinateDraft,
): CoordinatePreview | undefined {
  const result = coordinateFromDraft(draft);
  if (!result.coordinate || Object.keys(result.errors).length > 0)
    return undefined;
  return {
    side: formatMarchingSide(result.coordinate.side),
    frontBack: formatMarchingFrontBack(result.coordinate.frontBack),
  };
}

function parseMeasureRange(
  draft: MarchingCoordinateDraft,
  errors: SetFormErrors,
): MeasureRange | undefined {
  const startText = draft.measureStart.trim();
  const endText = draft.measureEnd.trim();
  if (!startText && !endText) return undefined;
  if (!startText || !endText) {
    const message = "Enter both measure start and end, or leave both blank.";
    if (!startText) errors.measureStart = message;
    if (!endText) errors.measureEnd = message;
    return undefined;
  }
  const start = parseNonNegativeInteger(
    startText,
    "Enter a valid start measure.",
  );
  const end = parseNonNegativeInteger(endText, "Enter a valid end measure.");
  if (typeof start === "string") errors.measureStart = start;
  if (typeof end === "string") errors.measureEnd = end;
  if (typeof start === "string" || typeof end === "string") return undefined;
  if (end < start) {
    errors.measureEnd = "End measure must be at or after the start measure.";
    return undefined;
  }
  return { start, end };
}

function coordinateFromDraft(draft: MarchingCoordinateDraft): {
  readonly errors: SetFormErrors;
  readonly coordinate?: MarchingCoordinate;
  readonly position?: DrillGridPoint;
} {
  const errors: SetFormErrors = {};
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
  if (typeof frontBackOffset === "string")
    errors.frontBackOffsetSteps = frontBackOffset;
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
    return {
      errors,
      coordinate,
      position: marchingCoordinateToDrillGridPoint(coordinate),
    };
  } catch (cause) {
    errors.coordinate = cause instanceof Error ? cause.message : String(cause);
    return { errors, coordinate };
  }
}

function parseNonNegativeInteger(
  value: string,
  message: string,
): number | string {
  if (!value.trim()) return message;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : message;
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
