import {
  assertFiniteFieldPoint,
  type FieldLateralReference,
  type FieldPoint,
} from "./types";
import {
  metersToStandardSteps,
  metersToYards,
  standardStepsToMeters,
  yardsToMeters,
} from "./units";
import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  type StandardHighSchoolFieldTemplate,
} from "./template";

const EPSILON = 1e-9;

export type MarchingSideReference = 1 | 2 | "center";
export type MarchingSideRelation = "on" | "inside" | "outside";
export type MarchingFrontBackRelation = "on" | "in-front-of" | "behind";

export interface MarchingSideCoordinate {
  /** Side 1/2 is a goal-line end; center is the 50-yard reference. */
  readonly side: MarchingSideReference;
  /** Side-relative yard line, from 0 through 50. */
  readonly yardLine: number;
  /** Non-negative distance from the selected yard-line reference. */
  readonly offsetSteps: number;
  readonly relation: MarchingSideRelation;
}

export interface MarchingFrontBackCoordinate {
  readonly reference: FieldLateralReference;
  /** Non-negative distance from the selected lateral reference. */
  readonly offsetSteps: number;
  readonly relation: MarchingFrontBackRelation;
}

export interface MarchingCoordinate {
  readonly side: MarchingSideCoordinate;
  readonly frontBack: MarchingFrontBackCoordinate;
  /** Set by conversion when the source point lies outside either boundary. */
  readonly outOfBounds?: readonly ("goal-to-goal" | "front-back")[];
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

/**
 * Marching labels are intentionally quarter-step friendly. The canonical
 * coordinate retains the unrounded value; only this display helper rounds it.
 */
export function formatMarchingSteps(steps: number): string {
  assertFinite(steps, "Steps");
  const quarterSteps = Math.round(steps * 4) / 4;
  const cleaned = Math.abs(quarterSteps) < EPSILON ? 0 : quarterSteps;
  const text = Number(cleaned.toFixed(2)).toString();
  return text;
}

function stepWord(steps: number, uppercase = true): string {
  const value = formatMarchingSteps(steps);
  const noun = Math.abs(Number(value)) === 1 ? "Step" : "Steps";
  return uppercase ? `${value} ${noun}` : `${value} ${noun.toLowerCase()}`;
}

function yardLineText(yardLine: number): string {
  return yardLine === 0 ? "Goal Line" : `${yardLine} yd ln`;
}

interface XReference {
  readonly xYards: number;
  readonly side: MarchingSideReference;
  readonly yardLine: number;
}

function xReferences(): readonly XReference[] {
  return Array.from({ length: 21 }, (_, index) => {
    const xYards = index * 5;
    if (xYards < 50) {
      return { xYards, side: 1, yardLine: xYards };
    }
    if (xYards > 50) {
      return { xYards, side: 2, yardLine: 100 - xYards };
    }
    return { xYards, side: "center", yardLine: 50 };
  });
}

const X_REFERENCES = xReferences();

interface LateralReference {
  readonly reference: FieldLateralReference;
  readonly yMeters: number;
}

function lateralReferences(
  template: StandardHighSchoolFieldTemplate,
): readonly LateralReference[] {
  return [
    {
      reference: "front-sideline",
      yMeters: template.bounds.minYMeters,
    },
    {
      reference: "front-hash",
      yMeters: template.frontHashLine.coordinateMeters,
    },
    {
      reference: "back-hash",
      yMeters: template.backHashLine.coordinateMeters,
    },
    {
      reference: "back-sideline",
      yMeters: template.bounds.maxYMeters,
    },
  ];
}

/**
 * Selects a nearest reference deterministically. Exact halfway ties choose
 * the candidate closer to the field center. The two HS hashes are symmetric;
 * when they tie at the exact lateral center, front hash wins as the stable
 * front-to-back ordering. This avoids display flicker at reference midpoints.
 */
function nearestReference<T extends { readonly coordinate: number }>(
  value: number,
  references: readonly T[],
  center: number,
): T {
  let best = references[0];
  let bestDistance = Math.abs(value - best.coordinate);
  for (const candidate of references.slice(1)) {
    const distance = Math.abs(value - candidate.coordinate);
    if (distance < bestDistance - EPSILON) {
      best = candidate;
      bestDistance = distance;
      continue;
    }
    if (Math.abs(distance - bestDistance) <= EPSILON) {
      const candidateCenterDistance = Math.abs(candidate.coordinate - center);
      const bestCenterDistance = Math.abs(best.coordinate - center);
      if (
        candidateCenterDistance < bestCenterDistance - EPSILON ||
        (Math.abs(candidateCenterDistance - bestCenterDistance) <= EPSILON &&
          candidate.coordinate < best.coordinate)
      ) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function sideRelation(
  side: MarchingSideReference,
  offsetXSteps: number,
): MarchingSideRelation {
  if (Math.abs(offsetXSteps) <= EPSILON) return "on";
  if (side === "center") return "outside";
  const towardCenter = side === 1 ? offsetXSteps > 0 : offsetXSteps < 0;
  return towardCenter ? "inside" : "outside";
}

function frontBackRelation(offsetYSteps: number): MarchingFrontBackRelation {
  if (Math.abs(offsetYSteps) <= EPSILON) return "on";
  return offsetYSteps < 0 ? "in-front-of" : "behind";
}

function makeSideCoordinate(xMeters: number): MarchingSideCoordinate {
  const xYards = metersToYards(xMeters);
  const references = X_REFERENCES.map((reference) => ({
    ...reference,
    coordinate: reference.xYards,
  }));
  const nearest = nearestReference(xYards, references, 50);
  const offsetXSteps = metersToStandardSteps(
    xMeters - yardsToMeters(nearest.xYards),
  );
  // Exactly on the 50 has no side. Any offset from the 50 is presented on the
  // point's actual side and uses the normal inside/outside vocabulary.
  const side =
    nearest.side === "center" && Math.abs(offsetXSteps) > EPSILON
      ? xMeters < yardsToMeters(50)
        ? 1
        : 2
      : nearest.side;
  return Object.freeze({
    side,
    yardLine: nearest.yardLine,
    offsetSteps: Math.abs(offsetXSteps),
    relation: sideRelation(side, offsetXSteps),
  });
}

function makeFrontBackCoordinate(
  yMeters: number,
  template: StandardHighSchoolFieldTemplate,
): MarchingFrontBackCoordinate {
  const references = lateralReferences(template).map((reference) => ({
    ...reference,
    coordinate: reference.yMeters,
  }));
  const nearest = nearestReference(
    yMeters,
    references,
    template.bounds.maxYMeters / 2,
  );
  const offsetYSteps = metersToStandardSteps(yMeters - nearest.yMeters);
  return Object.freeze({
    reference: nearest.reference,
    offsetSteps: Math.abs(offsetYSteps),
    relation: frontBackRelation(offsetYSteps),
  });
}

function getOutOfBounds(
  point: FieldPoint,
  template: StandardHighSchoolFieldTemplate,
): readonly ("goal-to-goal" | "front-back")[] | undefined {
  const outOfBounds: ("goal-to-goal" | "front-back")[] = [];
  if (
    point.xMeters < template.bounds.minXMeters - EPSILON ||
    point.xMeters > template.bounds.maxXMeters + EPSILON
  ) {
    outOfBounds.push("goal-to-goal");
  }
  if (
    point.yMeters < template.bounds.minYMeters - EPSILON ||
    point.yMeters > template.bounds.maxYMeters + EPSILON
  ) {
    outOfBounds.push("front-back");
  }
  return outOfBounds.length > 0 ? Object.freeze(outOfBounds) : undefined;
}

export function fieldPointToMarchingCoordinate(
  point: FieldPoint,
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): MarchingCoordinate {
  assertFiniteFieldPoint(point);
  const outOfBounds = getOutOfBounds(point, template);
  return Object.freeze({
    side: makeSideCoordinate(point.xMeters),
    frontBack: makeFrontBackCoordinate(point.yMeters, template),
    ...(outOfBounds ? { outOfBounds } : {}),
  });
}

function assertYardLine(yardLine: number): void {
  assertFinite(yardLine, "Marching yard line");
  if (yardLine < 0 || yardLine > 50) {
    throw new RangeError("Marching yard line must be between 0 and 50.");
  }
  if (Math.abs(yardLine / 5 - Math.round(yardLine / 5)) > EPSILON) {
    throw new RangeError("Marching yard line must be a five-yard line.");
  }
}

function assertOffset(offsetSteps: number, name: string): void {
  assertFinite(offsetSteps, name);
  if (offsetSteps < 0) {
    throw new RangeError(`${name} must be non-negative.`);
  }
}

function sideCoordinateToX(coordinate: MarchingSideCoordinate): number {
  assertYardLine(coordinate.yardLine);
  assertOffset(coordinate.offsetSteps, "Marching side offsetSteps");
  if (coordinate.relation === "on" && coordinate.offsetSteps > EPSILON) {
    throw new RangeError('An "on" marching coordinate must have zero offset.');
  }
  if (
    coordinate.yardLine === 50 &&
    ((coordinate.side === "center" && coordinate.relation !== "on") ||
      (coordinate.side !== "center" && coordinate.relation !== "outside"))
  ) {
    throw new RangeError(
      "The 50-yard line uses center/on or Side 1/2 outside coordinates.",
    );
  }
  const lineX =
    coordinate.side === "center"
      ? yardsToMeters(50)
      : yardsToMeters(
          coordinate.side === 1
            ? coordinate.yardLine
            : 100 - coordinate.yardLine,
        );
  if (coordinate.side === "center") {
    if (coordinate.relation === "on") return lineX;
    throw new RangeError('A center marching reference must use "on".');
  }
  if (coordinate.relation === "on") return lineX;
  if (coordinate.relation !== "inside" && coordinate.relation !== "outside") {
    throw new RangeError(
      'A Side 1/2 marching reference must use "on", "inside", or "outside".',
    );
  }
  const towardSide2 =
    coordinate.side === 1
      ? coordinate.relation === "inside"
      : coordinate.relation === "outside";
  const offset = standardStepsToMeters(coordinate.offsetSteps);
  return towardSide2 ? lineX + offset : lineX - offset;
}

function frontBackCoordinateToY(
  coordinate: MarchingFrontBackCoordinate,
  template: StandardHighSchoolFieldTemplate,
): number {
  assertOffset(coordinate.offsetSteps, "Marching front/back offsetSteps");
  if (coordinate.relation === "on" && coordinate.offsetSteps > EPSILON) {
    throw new RangeError('An "on" marching coordinate must have zero offset.');
  }
  const yByReference: Record<FieldLateralReference, number> = {
    "front-sideline": template.bounds.minYMeters,
    "front-hash": template.frontHashLine.coordinateMeters,
    "back-hash": template.backHashLine.coordinateMeters,
    "back-sideline": template.bounds.maxYMeters,
  };
  const lineY = yByReference[coordinate.reference];
  if (lineY === undefined) {
    throw new RangeError(
      `Unknown marching lateral reference: ${String(coordinate.reference)}.`,
    );
  }
  if (coordinate.relation === "on") return lineY;
  if (coordinate.relation === "in-front-of") {
    return lineY - standardStepsToMeters(coordinate.offsetSteps);
  }
  if (coordinate.relation === "behind") {
    return lineY + standardStepsToMeters(coordinate.offsetSteps);
  }
  throw new RangeError(
    'A marching front/back reference must use "on", "in-front-of", or "behind".',
  );
}

export function marchingCoordinateToFieldPoint(
  coordinate: MarchingCoordinate,
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldPoint {
  if (!coordinate || !coordinate.side || !coordinate.frontBack) {
    throw new TypeError(
      "A marching coordinate requires side and frontBack values.",
    );
  }
  const point = {
    xMeters: sideCoordinateToX(coordinate.side),
    yMeters: frontBackCoordinateToY(coordinate.frontBack, template),
  };
  assertFiniteFieldPoint(point, "Converted field point");
  return Object.freeze(point);
}

export const fieldPointToMarching = fieldPointToMarchingCoordinate;
export const marchingToFieldPoint = marchingCoordinateToFieldPoint;
export const fieldPositionToMarchingCoordinate = fieldPointToMarchingCoordinate;
export const marchingCoordinateToFieldPosition = marchingCoordinateToFieldPoint;

function formatSideCoordinate(coordinate: MarchingSideCoordinate): string {
  const line = yardLineText(coordinate.yardLine);
  if (coordinate.relation === "on") {
    return coordinate.side === "center"
      ? `On ${line}`
      : `Side ${coordinate.side}: On ${line}`;
  }
  const steps = stepWord(coordinate.offsetSteps);
  if (coordinate.side === "center") return `On ${line}`;
  return `Side ${coordinate.side}: ${steps} ${coordinate.relation} ${line}`;
}

function lateralReferenceText(reference: FieldLateralReference): string {
  switch (reference) {
    case "front-sideline":
      return "Front Sideline";
    case "front-hash":
      return "HS FH";
    case "back-hash":
      return "HS BH";
    case "back-sideline":
      return "Back Sideline";
  }
}

function formatFrontBackCoordinate(
  coordinate: MarchingFrontBackCoordinate,
): string {
  const reference = lateralReferenceText(coordinate.reference);
  if (coordinate.relation === "on") return `On ${reference}`;
  return `${stepWord(coordinate.offsetSteps)} ${
    coordinate.relation === "behind" ? "behind" : "in front of"
  } ${reference}`;
}

export function formatMarchingSide(coordinate: MarchingSideCoordinate): string {
  return formatSideCoordinate(coordinate);
}

export const formatMarchingSideCoordinate = formatMarchingSide;

export function formatMarchingFrontBack(
  coordinate: MarchingFrontBackCoordinate,
): string {
  return formatFrontBackCoordinate(coordinate);
}

export const formatMarchingFrontBackCoordinate = formatMarchingFrontBack;

export function formatMarchingCoordinate(
  coordinateOrPoint: MarchingCoordinate | FieldPoint,
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): string {
  const coordinate =
    "side" in coordinateOrPoint
      ? coordinateOrPoint
      : fieldPointToMarchingCoordinate(coordinateOrPoint, template);
  const parts = [
    formatSideCoordinate(coordinate.side),
    formatFrontBackCoordinate(coordinate.frontBack),
  ];
  const formatted = parts.join("; ");
  return coordinate.outOfBounds?.length
    ? `Out of Bounds — ${formatted}`
    : formatted;
}

export const formatMarchingPosition = formatMarchingCoordinate;
export const formatFieldPointAsMarching = formatMarchingCoordinate;
