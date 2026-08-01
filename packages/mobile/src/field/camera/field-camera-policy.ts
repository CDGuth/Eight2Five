import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  type StandardHighSchoolFieldTemplate,
} from "../template";
import { yardsToMeters } from "../units";
import type {
  FieldCameraBounds,
  FieldViewport,
  FieldViewportSize,
} from "./field-camera-types";

export const FIELD_GRID_PERIMETER_YARDS = 10;
export const FIELD_CAMERA_BLANK_MARGIN_YARDS = 5;
export const FIELD_MIN_METERS_PER_PIXEL = 0.02;
export const FIELD_ZOOM_OUT_BREATHING_ROOM = 1.2;
export const FIELD_INITIAL_BREATHING_ROOM = 1.06;

export function getFieldGridBounds(
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldCameraBounds {
  const padding = yardsToMeters(FIELD_GRID_PERIMETER_YARDS);
  return {
    minXMeters: template.bounds.minXMeters - padding,
    maxXMeters: template.bounds.maxXMeters + padding,
    minYMeters: template.bounds.minYMeters - padding,
    maxYMeters: template.bounds.maxYMeters + padding,
  };
}

export function getFieldCameraBounds(
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldCameraBounds {
  const gridBounds = getFieldGridBounds(template);
  const margin = yardsToMeters(FIELD_CAMERA_BLANK_MARGIN_YARDS);
  return {
    minXMeters: gridBounds.minXMeters - margin,
    maxXMeters: gridBounds.maxXMeters + margin,
    minYMeters: gridBounds.minYMeters - margin,
    maxYMeters: gridBounds.maxYMeters + margin,
  };
}

export function fitFieldBoundsMetersPerPixel(
  bounds: FieldCameraBounds,
  size: FieldViewportSize,
): number {
  "worklet";
  if (size.width <= 0 || size.height <= 0) return FIELD_MIN_METERS_PER_PIXEL;
  return Math.max(
    (bounds.maxXMeters - bounds.minXMeters) / size.width,
    (bounds.maxYMeters - bounds.minYMeters) / size.height,
  );
}

export function getFieldMaximumMetersPerPixel(
  size: FieldViewportSize,
  gridBounds: FieldCameraBounds,
): number {
  "worklet";
  return Math.max(
    FIELD_MIN_METERS_PER_PIXEL,
    fitFieldBoundsMetersPerPixel(gridBounds, size) *
      FIELD_ZOOM_OUT_BREATHING_ROOM,
  );
}

export function getInitialFieldViewport(
  size: FieldViewportSize,
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldViewport {
  const bounds = getFieldGridBounds(template);
  return {
    centerXMeters: (bounds.minXMeters + bounds.maxXMeters) / 2,
    centerYMeters: (bounds.minYMeters + bounds.maxYMeters) / 2,
    metersPerPixel: Math.max(
      FIELD_MIN_METERS_PER_PIXEL,
      fitFieldBoundsMetersPerPixel(bounds, size) * FIELD_INITIAL_BREATHING_ROOM,
    ),
  };
}
