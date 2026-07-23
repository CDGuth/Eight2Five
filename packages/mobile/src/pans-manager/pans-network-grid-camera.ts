import type {
  GridPoint,
  GridSize,
  GridViewport,
} from "./pans-network-grid-math";
import type { PansGridCameraSharedValues } from "./pans-network-grid-types";

export function panCameraCenter(
  startCenter: GridPoint,
  translationX: number,
  translationY: number,
  metersPerPixel: number,
): GridPoint {
  "worklet";
  return {
    xMeters: startCenter.xMeters - translationX * metersPerPixel,
    yMeters: startCenter.yMeters + translationY * metersPerPixel,
  };
}

export function screenPointToWorld(
  point: { x: number; y: number },
  size: GridSize,
  center: GridPoint,
  metersPerPixel: number,
): GridPoint {
  "worklet";
  return {
    xMeters: center.xMeters + (point.x - size.width / 2) * metersPerPixel,
    yMeters: center.yMeters - (point.y - size.height / 2) * metersPerPixel,
  };
}

export function centerForStationaryWorldPoint(
  worldPoint: GridPoint,
  screenPoint: { x: number; y: number },
  size: GridSize,
  metersPerPixel: number,
): GridPoint {
  "worklet";
  return {
    xMeters:
      worldPoint.xMeters - (screenPoint.x - size.width / 2) * metersPerPixel,
    yMeters:
      worldPoint.yMeters + (screenPoint.y - size.height / 2) * metersPerPixel,
  };
}

export function setGridCamera(
  camera: PansGridCameraSharedValues,
  viewport: GridViewport,
): void {
  "worklet";
  camera.centerX.value = viewport.centerXMeters;
  camera.centerY.value = viewport.centerYMeters;
  camera.metersPerPixel.value = viewport.metersPerPixel;
}

export function clampCameraAxis(
  center: number,
  minimum: number | undefined,
  maximum: number | undefined,
  halfVisibleSpan: number,
): number {
  "worklet";
  if (
    minimum === undefined ||
    maximum === undefined ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum >= maximum
  )
    return center;
  const minimumCenter = minimum + halfVisibleSpan;
  const maximumCenter = maximum - halfVisibleSpan;
  if (minimumCenter > maximumCenter) return (minimum + maximum) / 2;
  return Math.min(maximumCenter, Math.max(minimumCenter, center));
}
