/** The two goal-line ends of a football field. */
export type FieldSide = 1 | 2;

/** The four named lateral references used by marching coordinates. */
export type FieldLateralReference =
  | "front-sideline"
  | "front-hash"
  | "back-hash"
  | "back-sideline";

/**
 * A two-dimensional point in Eight2Five's canonical physical field space.
 *
 * The origin is center field (the 50-yard line) on the front sideline. X is
 * negative toward Side 1 and positive toward Side 2. Y is positive toward the
 * back sideline. Physical positions use meters; drill positions use the
 * separate DrillGridPoint type from @eight2five/drill-schema.
 */
export interface FieldPoint {
  readonly xMeters: number;
  readonly yMeters: number;
}

/** A field point with an optional vertical coordinate. Z increases upward. */
export interface FieldPosition extends FieldPoint {
  readonly zMeters?: number;
}

/**
 * The canonical three-dimensional position used for field anchors.
 * Coordinates are stored in meters and z increases upward.
 */
export interface AnchorFieldPosition extends FieldPoint {
  readonly zMeters: number;
}

/** The canonical physical origin and axis directions. */
export interface FieldCoordinateOrigin {
  readonly xMeters: 0;
  readonly yMeters: 0;
  readonly zMeters: 0;
  readonly longitudinalReference: "center-field";
  readonly lateralReference: "front-sideline";
}

export type FieldOrigin = FieldCoordinateOrigin;

export const FIELD_ORIGIN: FieldCoordinateOrigin = Object.freeze({
  xMeters: 0,
  yMeters: 0,
  zMeters: 0,
  longitudinalReference: "center-field",
  lateralReference: "front-sideline",
});

export const FIELD_COORDINATE_ORIGIN = FIELD_ORIGIN;

export const FIELD_AXIS_DIRECTIONS = Object.freeze({
  xNegative: "toward-side-1",
  xPositive: "toward-side-2",
  yPositive: "toward-back-sideline",
  zPositive: "up",
} as const);

/** Throws a clear error when a point contains a non-finite coordinate. */
export function assertFiniteFieldPoint(
  point: FieldPoint,
  name = "Field point",
): void {
  if (point === null || typeof point !== "object") {
    throw new TypeError(`${name} must be an object with xMeters and yMeters.`);
  }
  if (!Number.isFinite(point.xMeters)) {
    throw new RangeError(`${name}.xMeters must be a finite number.`);
  }
  if (!Number.isFinite(point.yMeters)) {
    throw new RangeError(`${name}.yMeters must be a finite number.`);
  }
}

/** Throws a clear error when a position contains a non-finite coordinate. */
export function assertFiniteFieldPosition(
  position: FieldPosition,
  name = "Field position",
): void {
  assertFiniteFieldPoint(position, name);
  if (position.zMeters !== undefined && !Number.isFinite(position.zMeters)) {
    throw new RangeError(`${name}.zMeters must be a finite number.`);
  }
}

/** Throws a clear error when a canonical anchor position is not finite. */
export function assertFiniteAnchorFieldPosition(
  position: AnchorFieldPosition,
  name = "Anchor field position",
): void {
  assertFiniteFieldPoint(position, name);
  if (!Number.isFinite(position.zMeters)) {
    throw new RangeError(`${name}.zMeters must be a finite number.`);
  }
}
