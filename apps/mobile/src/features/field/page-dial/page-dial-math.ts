export const PAGE_DIAL_DEAD_ZONE_DEGREES = 10;
export const PAGE_DIAL_USABLE_ARC_DEGREES = 360 - PAGE_DIAL_DEAD_ZONE_DEGREES;
export const PAGE_DIAL_START_ANGLE_DEGREES =
  -90 + PAGE_DIAL_DEAD_ZONE_DEGREES / 2;

const FULL_TURN_RADIANS = Math.PI * 2;

export function normalizePageIndex(index: number, pageCount: number): number {
  "worklet";
  if (pageCount <= 1) return 0;
  return Math.min(1, Math.max(0, index / (pageCount - 1)));
}

export function pageDialAngleForIndex(
  index: number,
  pageCount: number,
): number {
  "worklet";
  return (
    ((PAGE_DIAL_START_ANGLE_DEGREES +
      normalizePageIndex(index, pageCount) * PAGE_DIAL_USABLE_ARC_DEGREES) *
      Math.PI) /
    180
  );
}

export function pageDialProgressForAngle(angleRadians: number): number {
  "worklet";
  const start = (PAGE_DIAL_START_ANGLE_DEGREES * Math.PI) / 180;
  const usableArc = (PAGE_DIAL_USABLE_ARC_DEGREES * Math.PI) / 180;
  const rawRelative = (angleRadians - start) % FULL_TURN_RADIANS;
  const relative =
    rawRelative < 0 ? rawRelative + FULL_TURN_RADIANS : rawRelative;
  if (relative <= usableArc) return relative / usableArc;

  // Touches in the top dead zone clamp to the nearest endpoint. This avoids
  // wrapping directly from the first page to the last across ±π.
  const distanceFromEnd = relative - usableArc;
  const distanceFromStart = FULL_TURN_RADIANS - relative;
  return distanceFromStart <= distanceFromEnd ? 0 : 1;
}

export function pageDialIndexForAngle(
  angleRadians: number,
  pageCount: number,
): number {
  "worklet";
  if (pageCount <= 1) return 0;
  return Math.round(pageDialProgressForAngle(angleRadians) * (pageCount - 1));
}

export function pageDialIndexForPoint(
  x: number,
  y: number,
  diameter: number,
  pageCount: number,
): number {
  "worklet";
  const center = diameter / 2;
  return pageDialIndexForAngle(Math.atan2(y - center, x - center), pageCount);
}
