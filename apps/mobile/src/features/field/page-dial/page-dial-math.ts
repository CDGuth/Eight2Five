/**
 * Geometry shared by the React Native controls, the gesture worklet, and the
 * Skia renderer. Angles use the React Native coordinate system: zero points
 * right and positive values rotate clockwise because y grows downwards.
 */

export const PAGE_DIAL_DEAD_ZONE_DEGREES = 0;
export const PAGE_DIAL_USABLE_ARC_DEGREES = 360;
export const PAGE_DIAL_START_ANGLE_DEGREES = -90;
export const PAGE_DIAL_END_ANGLE_DEGREES = 270;

export const PAGE_DIAL_RING_THICKNESS_RATIO = 0.075;
export const PAGE_DIAL_INNER_DISK_DIAMETER_RATIO = 0.86;
export const PAGE_DIAL_CENTER_DISK_DIAMETER_RATIO = 0.3;
export const PAGE_DIAL_KNOB_DIAMETER_RATIO = 0.16;
export const PAGE_DIAL_CONTROL_CENTER_OFFSET_RATIO = 0.29;
export const PAGE_DIAL_MIN_CONTROL_SIZE = 44;

// The visual ring is about 0.46D from the center. Keeping this hit region
// wider makes the dial usable with a thumb without making the center button
// part of the gesture surface.
export const PAGE_DIAL_RING_HIT_INNER_RADIUS_RATIO = 0.36;
export const PAGE_DIAL_RING_HIT_OUTER_RADIUS_RATIO = 0.6;

// The knob and its shadow extend beyond the visual ring at the two endpoints.
// The canvas is rendered with this much overscan so neither is clipped.
export const PAGE_DIAL_CANVAS_OVERSCAN_RATIO = 0.09;

const FULL_TURN_RADIANS = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface PageDialPoint {
  readonly x: number;
  readonly y: number;
}

export interface PageDialLineSegment {
  readonly start: PageDialPoint;
  readonly end: PageDialPoint;
}

export interface PageDialRingHitRegion {
  readonly innerRadius: number;
  readonly outerRadius: number;
}

export interface PageDialCardinalPoints {
  readonly top: PageDialPoint;
  readonly right: PageDialPoint;
  readonly bottom: PageDialPoint;
  readonly left: PageDialPoint;
}

function clamp(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRadians(angleRadians: number): number {
  "worklet";
  const normalized = angleRadians % FULL_TURN_RADIANS;
  return normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized;
}

export function normalizePageIndex(index: number, pageCount: number): number {
  "worklet";
  if (
    pageCount <= 1 ||
    !Number.isFinite(pageCount) ||
    !Number.isFinite(index)
  ) {
    return 0;
  }
  return clamp(index / (pageCount - 1), 0, 1);
}

export const normalizePageProgress = normalizePageIndex;

export function pageDialAngleForProgress(progress: number): number {
  "worklet";
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  return (
    (PAGE_DIAL_START_ANGLE_DEGREES +
      clamp(safeProgress, 0, 1) * PAGE_DIAL_USABLE_ARC_DEGREES) *
    DEGREES_TO_RADIANS
  );
}

export function pageDialAngleForIndex(
  index: number,
  pageCount: number,
): number {
  "worklet";
  return pageDialAngleForProgress(normalizePageIndex(index, pageCount));
}

export function pageDialRelativeAngle(angleRadians: number): number {
  "worklet";
  const start = PAGE_DIAL_START_ANGLE_DEGREES * DEGREES_TO_RADIANS;
  return normalizeRadians(angleRadians - start);
}

export function pageDialAngleIsInValidArc(angleRadians: number): boolean {
  "worklet";
  return Number.isFinite(angleRadians);
}

export const isPageDialAngleInValidArc = pageDialAngleIsInValidArc;

export function pageDialProgressForAngle(angleRadians: number): number {
  "worklet";
  if (!Number.isFinite(angleRadians)) return 0;
  return pageDialRelativeAngle(angleRadians) / FULL_TURN_RADIANS;
}

/**
 * Resolve the shared top seam while still allowing the dial to wrap forever.
 * Exactly at the top, drag history decides whether the knob represents the
 * first set (0) or last set (1). Once the pointer crosses the seam, the wrapped
 * angular progress is returned immediately so clockwise motion moves last →
 * first and counter-clockwise motion moves first → last on every revolution.
 */
export function pageDialProgressForAngleNearReference(
  angleRadians: number,
  referenceProgress: number,
): number {
  "worklet";
  const wrapped = pageDialProgressForAngle(angleRadians);
  const reference = clamp(
    Number.isFinite(referenceProgress) ? referenceProgress : 0,
    0,
    1,
  );

  // atan2 resolves the exact top point to the start angle, so use the prior
  // state to preserve the intentional first/last ambiguity at that one point.
  if (wrapped === 0) {
    return reference > 0.5 ? 1 : 0;
  }

  return wrapped;
}

export function pageDialProgressForPoint(
  x: number,
  y: number,
  diameter: number,
): number {
  "worklet";
  const center = diameter / 2;
  if (x === center && y === center) return 0;
  return pageDialProgressForAngle(Math.atan2(y - center, x - center));
}

export function pageDialProgressForPointNearReference(
  x: number,
  y: number,
  diameter: number,
  referenceProgress: number,
): number {
  "worklet";
  const center = diameter / 2;
  if (x === center && y === center) return clamp(referenceProgress, 0, 1);
  return pageDialProgressForAngleNearReference(
    Math.atan2(y - center, x - center),
    referenceProgress,
  );
}

export function pageDialIndexForProgress(
  progress: number,
  pageCount: number,
): number {
  "worklet";
  if (pageCount <= 1 || !Number.isFinite(pageCount)) return 0;
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  return Math.round(clamp(safeProgress, 0, 1) * (pageCount - 1));
}

export function pageDialIndexForAngle(
  angleRadians: number,
  pageCount: number,
): number {
  "worklet";
  return pageDialIndexForProgress(
    pageDialProgressForAngle(angleRadians),
    pageCount,
  );
}

export function pageDialIndexForPoint(
  x: number,
  y: number,
  diameter: number,
  pageCount: number,
): number {
  "worklet";
  return pageDialIndexForProgress(
    pageDialProgressForPoint(x, y, diameter),
    pageCount,
  );
}

export function pageDialPointForAngle(
  angleRadians: number,
  diameter: number,
  radius = diameter / 2,
): PageDialPoint {
  "worklet";
  const center = diameter / 2;
  return {
    x: center + Math.cos(angleRadians) * radius,
    y: center + Math.sin(angleRadians) * radius,
  };
}

export function pageDialPointForProgress(
  progress: number,
  diameter: number,
  radius?: number,
): PageDialPoint {
  "worklet";
  const resolvedRadius =
    radius ?? diameter / 2 - (diameter * PAGE_DIAL_RING_THICKNESS_RATIO) / 2;
  return pageDialPointForAngle(
    pageDialAngleForProgress(progress),
    diameter,
    resolvedRadius,
  );
}

export const pageDialKnobPointForProgress = pageDialPointForProgress;

export function getPageDialRingRadius(
  diameter: number,
  ringThickness = diameter * PAGE_DIAL_RING_THICKNESS_RATIO,
): number {
  "worklet";
  return diameter / 2 - ringThickness / 2;
}

export function getPageDialRingHitRegion(
  diameter: number,
): PageDialRingHitRegion {
  "worklet";
  return {
    innerRadius: diameter * PAGE_DIAL_RING_HIT_INNER_RADIUS_RATIO,
    outerRadius: diameter * PAGE_DIAL_RING_HIT_OUTER_RADIUS_RATIO,
  };
}

export const pageDialRingHitRegion = getPageDialRingHitRegion;

export function pageDialRadialDistanceForPoint(
  x: number,
  y: number,
  diameter: number,
): number {
  "worklet";
  const center = diameter / 2;
  return Math.hypot(x - center, y - center);
}

export function pageDialPointIsInRingHitRegion(
  x: number,
  y: number,
  diameter: number,
): boolean {
  "worklet";
  const distance = pageDialRadialDistanceForPoint(x, y, diameter);
  const region = getPageDialRingHitRegion(diameter);
  return distance >= region.innerRadius && distance <= region.outerRadius;
}

export const isPageDialRingHit = pageDialPointIsInRingHitRegion;

export function getPageDialCardinalPoints(
  diameter: number,
  offset?: number,
): PageDialCardinalPoints {
  "worklet";
  const center = diameter / 2;
  const resolvedOffset =
    offset ?? diameter * PAGE_DIAL_CONTROL_CENTER_OFFSET_RATIO;
  return {
    top: { x: center, y: center - resolvedOffset },
    right: { x: center + resolvedOffset, y: center },
    bottom: { x: center, y: center + resolvedOffset },
    left: { x: center - resolvedOffset, y: center },
  };
}

export const pageDialCardinalPoints = getPageDialCardinalPoints;

export function getPageDialControlSize(diameter: number): number {
  "worklet";
  return Math.max(PAGE_DIAL_MIN_CONTROL_SIZE, diameter * 0.31);
}

/**
 * Returns whether a touch belongs to one of the four button hit boxes. The
 * ring detector uses this only at gesture start so a ring drag can pass over a
 * button without being interrupted after it has begun.
 */
export function pageDialPointIsInControlHitTarget(
  x: number,
  y: number,
  diameter: number,
): boolean {
  "worklet";
  const size = getPageDialControlSize(diameter);
  const halfSize = size / 2;
  const points = getPageDialCardinalPoints(diameter);
  return (
    (Math.abs(x - points.top.x) <= halfSize &&
      Math.abs(y - points.top.y) <= halfSize) ||
    (Math.abs(x - points.right.x) <= halfSize &&
      Math.abs(y - points.right.y) <= halfSize) ||
    (Math.abs(x - points.bottom.x) <= halfSize &&
      Math.abs(y - points.bottom.y) <= halfSize) ||
    (Math.abs(x - points.left.x) <= halfSize &&
      Math.abs(y - points.left.y) <= halfSize)
  );
}

export const pageDialPointHitsControl = pageDialPointIsInControlHitTarget;

function pointAtRadius(
  diameter: number,
  angleDegrees: number,
  radius: number,
): PageDialPoint {
  return pageDialPointForAngle(
    angleDegrees * DEGREES_TO_RADIANS,
    diameter,
    radius,
  );
}

/**
 * X dividers are split at the center disk rather than drawing underneath it.
 * This keeps both diagonals visibly flush with the blue disk edge and avoids
 * relying on paint order to hide a line through the center label.
 */
export function getPageDialDividerSegments(
  diameter: number,
  innerDiskDiameter = diameter * PAGE_DIAL_INNER_DISK_DIAMETER_RATIO,
  centerDiskDiameter = diameter * PAGE_DIAL_CENTER_DISK_DIAMETER_RATIO,
): readonly PageDialLineSegment[] {
  const outerRadius = innerDiskDiameter / 2;
  const innerRadius = centerDiskDiameter / 2;
  return [
    {
      start: pointAtRadius(diameter, -135, outerRadius),
      end: pointAtRadius(diameter, -135, innerRadius),
    },
    {
      start: pointAtRadius(diameter, -45, outerRadius),
      end: pointAtRadius(diameter, -45, innerRadius),
    },
    {
      start: pointAtRadius(diameter, 45, innerRadius),
      end: pointAtRadius(diameter, 45, outerRadius),
    },
    {
      start: pointAtRadius(diameter, 135, innerRadius),
      end: pointAtRadius(diameter, 135, outerRadius),
    },
  ];
}

export const pageDialDividerSegments = getPageDialDividerSegments;

export function getPageDialCanvasOverscan(diameter: number): number {
  return diameter * PAGE_DIAL_CANVAS_OVERSCAN_RATIO;
}
