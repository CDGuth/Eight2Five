import type { EntityIcon } from "@eight2five/drill-schema";
import type { FieldCameraPerspective } from "../camera/field-camera-types";
import { FIELD_LABEL_METERS_PER_FONT_UNIT } from "./field-render-tokens";

/** One sixth of a standard marching step, matching the label system's base scale. */
export const PERFORMER_LABEL_GAP_METERS = FIELD_LABEL_METERS_PER_FONT_UNIT * 4;

/** Icons that can be rendered as a directional path or as a circle. */
export type DrillShapeIcon = EntityIcon | "circle";

export interface DrillShapePoint {
  readonly x: number;
  readonly y: number;
}

export interface DrillPathShape {
  readonly kind: "path";
  readonly points: readonly DrillShapePoint[];
}

export interface DrillCircleShape {
  readonly kind: "circle";
  readonly radius: number;
}

export type DrillShapeGeometry = DrillPathShape | DrillCircleShape;

export interface DrillShapeTransformPolicy {
  /** Rotation to apply in the world-space Group under the camera reflection. */
  readonly rotationRadians: number;
  /** Every shape is constructed around this local origin. */
  readonly origin: Readonly<DrillShapePoint>;
}

export interface DrillLabelTransformPolicy {
  readonly scaleX: number;
  readonly scaleY: number;
}

/**
 * Moves a label so the bottom of its painted glyphs stays a fixed world-space
 * distance above the top of its marker. The gap therefore remains locked to
 * the marching grid rather than changing relative to it as the camera zooms.
 */
export function getDrillLabelVerticalOffsetUnits(
  labelScale: number,
  markerHalfHeightMeters: number,
  paintedBottomUnits: number,
  gapMeters?: number,
): number {
  "worklet";
  const resolvedGapMeters = gapMeters ?? 0.09525;
  if (
    !Number.isFinite(labelScale) ||
    labelScale <= 0 ||
    !Number.isFinite(markerHalfHeightMeters) ||
    markerHalfHeightMeters < 0 ||
    !Number.isFinite(paintedBottomUnits) ||
    !Number.isFinite(resolvedGapMeters) ||
    resolvedGapMeters < 0
  ) {
    return 0;
  }
  const targetBottomUnits =
    -(markerHalfHeightMeters + resolvedGapMeters) / labelScale;
  return targetBottomUnits - paintedBottomUnits;
}

/**
 * Label text is converted into fixed world-space meters, so labels scale with
 * the field instead of remaining a constant size on screen. The signs only
 * cancel the camera reflection/rotation needed to keep text readable.
 */
export function getDrillLabelTransformPolicy(
  perspective: FieldCameraPerspective = "director",
  scale = FIELD_LABEL_METERS_PER_FONT_UNIT,
): DrillLabelTransformPolicy {
  "worklet";
  return perspective === "performer"
    ? { scaleX: -scale, scaleY: scale }
    : { scaleX: scale, scaleY: -scale };
}

/**
 * Construct a shape in world coordinates that appears upright after the field
 * camera's scaleY(-1). A visually upward point therefore has a positive world
 * Y coordinate, unlike an ordinary screen-space path.
 */
export function createDrillShapeGeometry(
  icon: DrillShapeIcon,
  width: number,
  height: number,
): DrillShapeGeometry {
  assertPositiveFinite(width, "Drill shape width");
  assertPositiveFinite(height, "Drill shape height");

  if (icon === "dot" || icon === "circle") {
    return Object.freeze({
      kind: "circle",
      radius: Math.min(width, height) / 2,
    });
  }

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.min(halfWidth, halfHeight);
  let points: readonly DrillShapePoint[];

  switch (icon) {
    case "triangle":
      points = [
        { x: 0, y: halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: -halfWidth, y: -halfHeight },
      ];
      break;
    case "diamond":
      points = [
        { x: 0, y: halfHeight },
        { x: halfWidth, y: 0 },
        { x: 0, y: -halfHeight },
        { x: -halfWidth, y: 0 },
      ];
      break;
    case "star":
      points = Array.from({ length: 10 }, (_, index) => {
        const angle = Math.PI / 2 - (index * Math.PI) / 5;
        const pointRadius = index % 2 === 0 ? radius : radius * 0.45;
        return {
          x: Math.cos(angle) * pointRadius * (halfWidth / radius),
          y: Math.sin(angle) * pointRadius * (halfHeight / radius),
        };
      });
      break;
    case "hexagon":
      points = Array.from({ length: 6 }, (_, index) => {
        const angle = Math.PI / 2 - (index * Math.PI) / 3;
        return {
          x: Math.cos(angle) * halfWidth,
          y: Math.sin(angle) * halfHeight,
        };
      });
      break;
    case "cross": {
      const armWidth = halfWidth * 0.36;
      const armHeight = halfHeight * 0.36;
      points = [
        { x: -armWidth, y: halfHeight },
        { x: armWidth, y: halfHeight },
        { x: armWidth, y: armHeight },
        { x: halfWidth, y: armHeight },
        { x: halfWidth, y: -armHeight },
        { x: armWidth, y: -armHeight },
        { x: armWidth, y: -halfHeight },
        { x: -armWidth, y: -halfHeight },
        { x: -armWidth, y: -armHeight },
        { x: -halfWidth, y: -armHeight },
        { x: -halfWidth, y: armHeight },
        { x: -armWidth, y: armHeight },
      ];
      break;
    }
    case "square":
    default:
      points = [
        { x: -halfWidth, y: halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: -halfWidth, y: -halfHeight },
      ];
      break;
  }

  return Object.freeze({
    kind: "path",
    points: Object.freeze(points.map((point) => Object.freeze(point))),
  });
}

/**
 * Convert a field-space facing angle to a Skia Group rotation beneath the
 * camera's negative Y scale. Negating the angle preserves the same directional
 * heading in the user's upright view while keeping rotation in radians.
 */
export function getDrillShapeTransformPolicy(
  facingDegrees?: number,
): DrillShapeTransformPolicy {
  if (facingDegrees !== undefined && !Number.isFinite(facingDegrees)) {
    throw new RangeError("Drill facing degrees must be finite.");
  }
  return Object.freeze({
    rotationRadians:
      facingDegrees === undefined ? 0 : (-facingDegrees * Math.PI) / 180,
    origin: Object.freeze({ x: 0, y: 0 }),
  });
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
}
