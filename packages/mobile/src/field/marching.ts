import {
  drillGridToPhysicalPoint,
  getFieldPreset,
  physicalPointToDrillGrid,
  type DrillGridPoint,
} from "@eight2five/drill-schema";

import {
  assertFiniteFieldPoint,
  type FieldLateralReference,
  type FieldPoint,
} from "./types";
import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  type StandardHighSchoolFieldTemplate,
} from "./template";

const EPSILON = 1e-9;
const NFHS_FIELD = getFieldPreset("football-nfhs");

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
  return Number(cleaned.toFixed(2)).toString();
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
  readonly xSteps: number;
  readonly side: MarchingSideReference;
  readonly yardLine: number;
}

function xReferences(): readonly XReference[] {
  return Array.from({ length: 21 }, (_, index) => {
    const xSteps = -80 + index * 8;
    if (xSteps < 0) {
      return {
        xSteps,
        side: 1,
        yardLine: 50 - (Math.abs(xSteps) / 8) * 5,
      };
    }
    if (xSteps > 0) {
      return {
        xSteps,
        side: 2,
        yardLine: 50 - (Math.abs(xSteps) / 8) * 5,
      };
    }
    return { xSteps: 0, side: "center", yardLine: 50 };
  });
}

const X_REFERENCES = xReferences();

interface LateralReference {
  readonly reference: FieldLateralReference;
  readonly ySteps: number;
}

const LATERAL_REFERENCES: readonly LateralReference[] = Object.freeze([
  { reference: "front-sideline", ySteps: 0 },
  { reference: "front-hash", ySteps: 28 },
  { reference: "back-hash", ySteps: 56 },
  { reference: "back-sideline", ySteps: 84 },
]);

/** Deterministic nearest-reference selection avoids display flicker at ties. */
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

function makeSideCoordinate(xSteps: number): MarchingSideCoordinate {
  const references = X_REFERENCES.map((reference) => ({
    ...reference,
    coordinate: reference.xSteps,
  }));
  const nearest = nearestReference(xSteps, references, 0);
  const offsetXSteps = xSteps - nearest.xSteps;
  const side =
    nearest.side === "center" && Math.abs(offsetXSteps) > EPSILON
      ? xSteps < 0
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

function makeFrontBackCoordinate(ySteps: number): MarchingFrontBackCoordinate {
  const references = LATERAL_REFERENCES.map((reference) => ({
    ...reference,
    coordinate: reference.ySteps,
  }));
  const nearest = nearestReference(ySteps, references, 42);
  const offsetYSteps = ySteps - nearest.ySteps;
  return Object.freeze({
    reference: nearest.reference,
    offsetSteps: Math.abs(offsetYSteps),
    relation: frontBackRelation(offsetYSteps),
  });
}

function getGridOutOfBounds(
  point: DrillGridPoint,
): readonly ("goal-to-goal" | "front-back")[] | undefined {
  const outOfBounds: ("goal-to-goal" | "front-back")[] = [];
  if (point.xSteps < -80 - EPSILON || point.xSteps > 80 + EPSILON) {
    outOfBounds.push("goal-to-goal");
  }
  if (point.ySteps < -EPSILON || point.ySteps > 84 + EPSILON) {
    outOfBounds.push("front-back");
  }
  return outOfBounds.length > 0 ? Object.freeze(outOfBounds) : undefined;
}

export function drillGridPointToMarchingCoordinate(
  point: DrillGridPoint,
): MarchingCoordinate {
  if (!Number.isFinite(point.xSteps) || !Number.isFinite(point.ySteps)) {
    throw new RangeError("Drill grid coordinates must be finite.");
  }
  const outOfBounds = getGridOutOfBounds(point);
  return Object.freeze({
    side: makeSideCoordinate(point.xSteps),
    frontBack: makeFrontBackCoordinate(point.ySteps),
    ...(outOfBounds ? { outOfBounds } : {}),
  });
}

export function fieldPointToMarchingCoordinate(
  point: FieldPoint,
  _template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): MarchingCoordinate {
  assertFiniteFieldPoint(point);
  return drillGridPointToMarchingCoordinate(
    physicalPointToDrillGrid(point, NFHS_FIELD),
  );
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

function sideCoordinateToXSteps(coordinate: MarchingSideCoordinate): number {
  assertYardLine(coordinate.yardLine);
  assertOffset(coordinate.offsetSteps, "Marching side offsetSteps");
  if (coordinate.relation === "on" && coordinate.offsetSteps > EPSILON) {
    throw new RangeError('An "on" marching coordinate must have zero offset.');
  }

  if (coordinate.yardLine === 50) {
    if (coordinate.side === "center") {
      if (coordinate.relation !== "on" || coordinate.offsetSteps > EPSILON) {
        throw new RangeError('The center 50-yard reference must be exactly "on".');
      }
      return 0;
    }
    if (coordinate.relation === "on") return 0;
    if (coordinate.relation !== "outside") {
      throw new RangeError(
        "An offset from the 50-yard line must be outside on Side 1 or Side 2.",
      );
    }
    return coordinate.side === 1
      ? -coordinate.offsetSteps
      : coordinate.offsetSteps;
  }

  if (coordinate.side === "center") {
    throw new RangeError("Only the 50-yard line can use the center side reference.");
  }

  const baseMagnitude = ((50 - coordinate.yardLine) / 5) * 8;
  const base = coordinate.side === 1 ? -baseMagnitude : baseMagnitude;
  if (coordinate.relation === "on") return base;
  if (coordinate.relation !== "inside" && coordinate.relation !== "outside") {
    throw new RangeError(
      'A Side 1/2 marching reference must use "on", "inside", or "outside".',
    );
  }
  const towardCenter = coordinate.relation === "inside";
  if (coordinate.side === 1) {
    return base + (towardCenter ? coordinate.offsetSteps : -coordinate.offsetSteps);
  }
  return base + (towardCenter ? -coordinate.offsetSteps : coordinate.offsetSteps);
}

function frontBackCoordinateToYSteps(
  coordinate: MarchingFrontBackCoordinate,
): number {
  assertOffset(coordinate.offsetSteps, "Marching front/back offsetSteps");
  if (coordinate.relation === "on" && coordinate.offsetSteps > EPSILON) {
    throw new RangeError('An "on" marching coordinate must have zero offset.');
  }
  const yByReference: Record<FieldLateralReference, number> = {
    "front-sideline": 0,
    "front-hash": 28,
    "back-hash": 56,
    "back-sideline": 84,
  };
  const lineY = yByReference[coordinate.reference];
  if (coordinate.relation === "on") return lineY;
  if (coordinate.relation === "in-front-of") {
    return lineY - coordinate.offsetSteps;
  }
  if (coordinate.relation === "behind") {
    return lineY + coordinate.offsetSteps;
  }
  throw new RangeError(
    'A marching front/back reference must use "on", "in-front-of", or "behind".',
  );
}

export function marchingCoordinateToDrillGridPoint(
  coordinate: MarchingCoordinate,
): DrillGridPoint {
  if (!coordinate || !coordinate.side || !coordinate.frontBack) {
    throw new TypeError(
      "A marching coordinate requires side and frontBack values.",
    );
  }
  return Object.freeze({
    xSteps: sideCoordinateToXSteps(coordinate.side),
    ySteps: frontBackCoordinateToYSteps(coordinate.frontBack),
  });
}

export function marchingCoordinateToFieldPoint(
  coordinate: MarchingCoordinate,
  _template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldPoint {
  const physical = drillGridToPhysicalPoint(
    marchingCoordinateToDrillGridPoint(coordinate),
    NFHS_FIELD,
  );
  const point = {
    xMeters: physical.xMeters,
    yMeters: physical.yMeters,
  };
  assertFiniteFieldPoint(point, "Converted field point");
  return Object.freeze(point);
}

export function drillGridPointToFieldPoint(point: DrillGridPoint): FieldPoint {
  const physical = drillGridToPhysicalPoint(point, NFHS_FIELD);
  return Object.freeze({
    xMeters: physical.xMeters,
    yMeters: physical.yMeters,
  });
}

export function fieldPointToDrillGridPoint(point: FieldPoint): DrillGridPoint {
  assertFiniteFieldPoint(point);
  return physicalPointToDrillGrid(point, NFHS_FIELD);
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
  coordinateOrPoint: MarchingCoordinate | FieldPoint | DrillGridPoint,
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): string {
  let coordinate: MarchingCoordinate;
  if ("side" in coordinateOrPoint) {
    coordinate = coordinateOrPoint;
  } else if ("xSteps" in coordinateOrPoint) {
    coordinate = drillGridPointToMarchingCoordinate(coordinateOrPoint);
  } else {
    coordinate = fieldPointToMarchingCoordinate(coordinateOrPoint, template);
  }
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
