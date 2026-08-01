import type { FieldPoint } from "../types";
import type {
  FieldCamera,
  FieldCameraBounds,
  FieldPanBaseline,
  FieldViewport,
  FieldViewportSize,
} from "./field-camera-types";

export function setFieldCamera(
  camera: FieldCamera,
  viewport: FieldViewport,
): void {
  "worklet";
  camera.centerXMeters.value = viewport.centerXMeters;
  camera.centerYMeters.value = viewport.centerYMeters;
  camera.metersPerPixel.value = viewport.metersPerPixel;
}

export function fieldWorldToScreen(
  point: FieldPoint,
  viewport: FieldViewport,
  size: FieldViewportSize,
): { x: number; y: number } {
  "worklet";
  return {
    x:
      size.width / 2 +
      (point.xMeters - viewport.centerXMeters) / viewport.metersPerPixel,
    y:
      size.height / 2 -
      (point.yMeters - viewport.centerYMeters) / viewport.metersPerPixel,
  };
}

export function fieldScreenToWorld(
  point: { readonly x: number; readonly y: number },
  viewport: FieldViewport,
  size: FieldViewportSize,
): FieldPoint {
  "worklet";
  return {
    xMeters:
      viewport.centerXMeters +
      (point.x - size.width / 2) * viewport.metersPerPixel,
    yMeters:
      viewport.centerYMeters -
      (point.y - size.height / 2) * viewport.metersPerPixel,
  };
}

export function createFieldPanBaseline(
  center: FieldPoint,
  translationX: number,
  translationY: number,
  metersPerPixel: number,
): FieldPanBaseline {
  "worklet";
  return { center, translationX, translationY, metersPerPixel };
}

/** Uses translation deltas from a baseline so a 1→2→1 pointer change can rebase. */
export function fieldPanCenter(
  baseline: FieldPanBaseline,
  translationX: number,
  translationY: number,
): FieldPoint {
  "worklet";
  return {
    xMeters:
      baseline.center.xMeters -
      (translationX - baseline.translationX) * baseline.metersPerPixel,
    yMeters:
      baseline.center.yMeters +
      (translationY - baseline.translationY) * baseline.metersPerPixel,
  };
}

export function fieldCenterForStationaryWorldPoint(
  worldPoint: FieldPoint,
  screenPoint: { readonly x: number; readonly y: number },
  size: FieldViewportSize,
  metersPerPixel: number,
): FieldPoint {
  "worklet";
  return {
    xMeters:
      worldPoint.xMeters - (screenPoint.x - size.width / 2) * metersPerPixel,
    yMeters:
      worldPoint.yMeters + (screenPoint.y - size.height / 2) * metersPerPixel,
  };
}

export function clampFieldCameraAxis(
  center: number,
  minimum: number,
  maximum: number,
  halfVisibleSpan: number,
): number {
  "worklet";
  const minimumCenter = minimum + halfVisibleSpan;
  const maximumCenter = maximum - halfVisibleSpan;
  if (minimumCenter > maximumCenter) return (minimum + maximum) / 2;
  return Math.min(maximumCenter, Math.max(minimumCenter, center));
}

export function clampFieldViewport(
  viewport: FieldViewport,
  size: FieldViewportSize,
  bounds: FieldCameraBounds,
): FieldViewport {
  "worklet";
  const halfWidth = (size.width * viewport.metersPerPixel) / 2;
  const halfHeight = (size.height * viewport.metersPerPixel) / 2;
  return {
    ...viewport,
    centerXMeters: clampFieldCameraAxis(
      viewport.centerXMeters,
      bounds.minXMeters,
      bounds.maxXMeters,
      halfWidth,
    ),
    centerYMeters: clampFieldCameraAxis(
      viewport.centerYMeters,
      bounds.minYMeters,
      bounds.maxYMeters,
      halfHeight,
    ),
  };
}

export interface FieldCameraTransform {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly translateX: number;
  readonly translateY: number;
}

export function fieldCameraTransform(
  viewport: FieldViewport,
  size: FieldViewportSize,
): FieldCameraTransform {
  "worklet";
  const scale = 1 / viewport.metersPerPixel;
  return {
    scaleX: scale,
    scaleY: -scale,
    translateX: size.width / 2 - viewport.centerXMeters * scale,
    translateY: size.height / 2 + viewport.centerYMeters * scale,
  };
}

export function applyFieldCameraTransform(
  point: FieldPoint,
  transform: FieldCameraTransform,
): { x: number; y: number } {
  "worklet";
  return {
    x: point.xMeters * transform.scaleX + transform.translateX,
    y: point.yMeters * transform.scaleY + transform.translateY,
  };
}
