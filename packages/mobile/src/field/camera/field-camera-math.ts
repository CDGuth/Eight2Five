import type { FieldPoint } from "../types";
import type {
  FieldCamera,
  FieldCameraBounds,
  FieldCameraPerspective,
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
  perspective: FieldCameraPerspective = "director",
): { x: number; y: number } {
  "worklet";
  const xSign = perspective === "performer" ? -1 : 1;
  const ySign = perspective === "performer" ? 1 : -1;
  return {
    x:
      size.width / 2 +
      ((point.xMeters - viewport.centerXMeters) / viewport.metersPerPixel) *
        xSign,
    y:
      size.height / 2 +
      ((point.yMeters - viewport.centerYMeters) / viewport.metersPerPixel) *
        ySign,
  };
}

export function fieldScreenToWorld(
  point: { readonly x: number; readonly y: number },
  viewport: FieldViewport,
  size: FieldViewportSize,
  perspective: FieldCameraPerspective = "director",
): FieldPoint {
  "worklet";
  const xSign = perspective === "performer" ? -1 : 1;
  const ySign = perspective === "performer" ? 1 : -1;
  return {
    xMeters:
      viewport.centerXMeters +
      (point.x - size.width / 2) * viewport.metersPerPixel * xSign,
    yMeters:
      viewport.centerYMeters +
      (point.y - size.height / 2) * viewport.metersPerPixel * ySign,
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
  perspective: FieldCameraPerspective = "director",
): FieldPoint {
  "worklet";
  const xSign = perspective === "performer" ? -1 : 1;
  const ySign = perspective === "performer" ? 1 : -1;
  return {
    xMeters:
      baseline.center.xMeters -
      (translationX - baseline.translationX) * baseline.metersPerPixel * xSign,
    yMeters:
      baseline.center.yMeters -
      (translationY - baseline.translationY) * baseline.metersPerPixel * ySign,
  };
}

export function fieldCenterForStationaryWorldPoint(
  worldPoint: FieldPoint,
  screenPoint: { readonly x: number; readonly y: number },
  size: FieldViewportSize,
  metersPerPixel: number,
  perspective: FieldCameraPerspective = "director",
): FieldPoint {
  "worklet";
  const xSign = perspective === "performer" ? -1 : 1;
  const ySign = perspective === "performer" ? 1 : -1;
  return {
    xMeters:
      worldPoint.xMeters -
      (screenPoint.x - size.width / 2) * metersPerPixel * xSign,
    yMeters:
      worldPoint.yMeters -
      (screenPoint.y - size.height / 2) * metersPerPixel * ySign,
  };
}

export function clampFieldCameraAxis(
  center: number,
  minimum: number,
  maximum: number,
  _halfVisibleSpan = 0,
): number {
  "worklet";
  // Clamp only the camera center. A zoomed-out viewport is intentionally
  // allowed to extend beyond the camera bounds; otherwise a large viewport
  // collapses the valid pan range to a single centered point.
  return Math.min(maximum, Math.max(minimum, center));
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
  perspective: FieldCameraPerspective = "director",
): FieldCameraTransform {
  "worklet";
  const scale = 1 / viewport.metersPerPixel;
  const scaleX = scale * (perspective === "performer" ? -1 : 1);
  const scaleY = scale * (perspective === "performer" ? 1 : -1);
  return {
    scaleX,
    scaleY,
    translateX: size.width / 2 - viewport.centerXMeters * scaleX,
    translateY: size.height / 2 - viewport.centerYMeters * scaleY,
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
