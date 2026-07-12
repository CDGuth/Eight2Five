export interface GridPoint {
  xMeters: number;
  yMeters: number;
}

export interface GridSize {
  width: number;
  height: number;
}

export interface GridViewport {
  centerXMeters: number;
  centerYMeters: number;
  metersPerPixel: number;
}

export interface GridBounds {
  minXMeters: number;
  maxXMeters: number;
  minYMeters: number;
  maxYMeters: number;
}

export const DEFAULT_GRID_VIEWPORT: GridViewport = {
  centerXMeters: 0,
  centerYMeters: 0,
  metersPerPixel: 0.1,
};

export function worldToScreen(
  point: GridPoint,
  viewport: GridViewport,
  size: GridSize,
): { x: number; y: number } {
  return {
    x:
      size.width / 2 +
      (point.xMeters - viewport.centerXMeters) / viewport.metersPerPixel,
    y:
      size.height / 2 -
      (point.yMeters - viewport.centerYMeters) / viewport.metersPerPixel,
  };
}

export function screenToWorld(
  point: { x: number; y: number },
  viewport: GridViewport,
  size: GridSize,
): GridPoint {
  return {
    xMeters:
      viewport.centerXMeters +
      (point.x - size.width / 2) * viewport.metersPerPixel,
    yMeters:
      viewport.centerYMeters -
      (point.y - size.height / 2) * viewport.metersPerPixel,
  };
}

export function panGridViewport(
  viewport: GridViewport,
  deltaPixels: { x: number; y: number },
): GridViewport {
  return {
    ...viewport,
    centerXMeters:
      viewport.centerXMeters - deltaPixels.x * viewport.metersPerPixel,
    centerYMeters:
      viewport.centerYMeters + deltaPixels.y * viewport.metersPerPixel,
  };
}

/** Zooms around a screen-space focal point so the world coordinate stays put. */
export function zoomGridViewport(
  viewport: GridViewport,
  size: GridSize,
  focalPoint: { x: number; y: number },
  scale: number,
  minimumMetersPerPixel = 0.0001,
  maximumMetersPerPixel = 10_000,
): GridViewport {
  const worldFocal = screenToWorld(focalPoint, viewport, size);
  const metersPerPixel = Math.min(
    maximumMetersPerPixel,
    Math.max(
      minimumMetersPerPixel,
      viewport.metersPerPixel / Math.max(Number.EPSILON, scale),
    ),
  );
  return {
    centerXMeters:
      worldFocal.xMeters - (focalPoint.x - size.width / 2) * metersPerPixel,
    centerYMeters:
      worldFocal.yMeters + (focalPoint.y - size.height / 2) * metersPerPixel,
    metersPerPixel,
  };
}

/** Selects a 1/2/5 × 10ⁿ interval near the requested on-screen spacing. */
export function chooseGridInterval(
  metersPerPixel: number,
  targetPixels = 80,
): number {
  const target = Math.max(Number.EPSILON, metersPerPixel * targetPixels);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function boundsForPoints(points: GridPoint[]): GridBounds | undefined {
  if (!points.length) return undefined;
  return points.reduce<GridBounds>(
    (bounds, point) => ({
      minXMeters: Math.min(bounds.minXMeters, point.xMeters),
      maxXMeters: Math.max(bounds.maxXMeters, point.xMeters),
      minYMeters: Math.min(bounds.minYMeters, point.yMeters),
      maxYMeters: Math.max(bounds.maxYMeters, point.yMeters),
    }),
    {
      minXMeters: points[0].xMeters,
      maxXMeters: points[0].xMeters,
      minYMeters: points[0].yMeters,
      maxYMeters: points[0].yMeters,
    },
  );
}

export function fitGridBounds(
  bounds: GridBounds | undefined,
  size: GridSize,
  paddingPixels = 32,
): GridViewport {
  if (!bounds || size.width <= 0 || size.height <= 0)
    return DEFAULT_GRID_VIEWPORT;
  const usableWidth = Math.max(1, size.width - paddingPixels * 2);
  const usableHeight = Math.max(1, size.height - paddingPixels * 2);
  const spanX = Math.max(1, bounds.maxXMeters - bounds.minXMeters);
  const spanY = Math.max(1, bounds.maxYMeters - bounds.minYMeters);
  return {
    centerXMeters: (bounds.minXMeters + bounds.maxXMeters) / 2,
    centerYMeters: (bounds.minYMeters + bounds.maxYMeters) / 2,
    metersPerPixel: Math.max(spanX / usableWidth, spanY / usableHeight, 0.001),
  };
}
