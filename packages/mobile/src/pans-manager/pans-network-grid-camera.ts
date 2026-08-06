import type {
  GridPoint,
  GridSize,
  GridViewport,
} from "./pans-network-grid-math";
import type { PansGridCameraSharedValues } from "./pans-network-grid-types";
import {
  clampFieldCameraAxis,
  fieldCenterForStationaryWorldPoint,
  fieldScreenToWorld,
} from "../field/camera/field-camera-math";

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
  return fieldScreenToWorld(
    point,
    {
      centerXMeters: center.xMeters,
      centerYMeters: center.yMeters,
      metersPerPixel,
    },
    size,
  );
}

export function centerForStationaryWorldPoint(
  worldPoint: GridPoint,
  screenPoint: { x: number; y: number },
  size: GridSize,
  metersPerPixel: number,
): GridPoint {
  "worklet";
  return fieldCenterForStationaryWorldPoint(
    worldPoint,
    screenPoint,
    size,
    metersPerPixel,
  );
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
  return clampFieldCameraAxis(center, minimum, maximum, halfVisibleSpan);
}
