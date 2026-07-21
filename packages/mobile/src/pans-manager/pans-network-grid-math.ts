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

export const MIN_GRID_METERS_PER_PIXEL = 0.0001;
export const MAX_GRID_METERS_PER_PIXEL = 10_000;

export function normalizeGridViewport(
  viewport: GridViewport,
  minimumMetersPerPixel = MIN_GRID_METERS_PER_PIXEL,
  maximumMetersPerPixel = MAX_GRID_METERS_PER_PIXEL,
): GridViewport {
  return {
    centerXMeters: Number.isFinite(viewport.centerXMeters)
      ? viewport.centerXMeters
      : DEFAULT_GRID_VIEWPORT.centerXMeters,
    centerYMeters: Number.isFinite(viewport.centerYMeters)
      ? viewport.centerYMeters
      : DEFAULT_GRID_VIEWPORT.centerYMeters,
    metersPerPixel: Math.min(
      maximumMetersPerPixel,
      Math.max(
        minimumMetersPerPixel,
        Number.isFinite(viewport.metersPerPixel)
          ? viewport.metersPerPixel
          : DEFAULT_GRID_VIEWPORT.metersPerPixel,
      ),
    ),
  };
}

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

export interface GridCameraTransform {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

/** Affine world-to-screen transform used by the Skia camera group. */
export function gridCameraTransform(
  viewport: GridViewport,
  size: GridSize,
): GridCameraTransform {
  const normalized = normalizeGridViewport(viewport);
  const scale = 1 / normalized.metersPerPixel;
  return {
    scaleX: scale,
    scaleY: -scale,
    translateX: size.width / 2 - normalized.centerXMeters * scale,
    translateY: size.height / 2 + normalized.centerYMeters * scale,
  };
}

export function applyGridCameraTransform(
  point: GridPoint,
  transform: GridCameraTransform,
): { x: number; y: number } {
  return {
    x: point.xMeters * transform.scaleX + transform.translateX,
    y: point.yMeters * transform.scaleY + transform.translateY,
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

export interface ConsolidatedGridPathOptions {
  showGrid?: boolean;
  showOrigin?: boolean;
  overscanScreens?: number;
  maximumLines?: number;
}

/** Builds one world-space SVG path for every visible grid and origin line. */
export function buildConsolidatedGridPath(
  viewport: GridViewport,
  size: GridSize,
  intervalMeters: number,
  options: ConsolidatedGridPathOptions = {},
): string {
  const {
    showGrid = true,
    showOrigin = false,
    overscanScreens = 1,
    maximumLines = 2_000,
  } = options;
  if (
    size.width <= 0 ||
    size.height <= 0 ||
    !Number.isFinite(intervalMeters) ||
    intervalMeters <= 0 ||
    (!showGrid && !showOrigin)
  )
    return "";

  const normalized = normalizeGridViewport(viewport);
  const halfWidthMeters =
    (size.width * normalized.metersPerPixel * (1 + overscanScreens * 2)) / 2;
  const halfHeightMeters =
    (size.height * normalized.metersPerPixel * (1 + overscanScreens * 2)) / 2;
  const minX = normalized.centerXMeters - halfWidthMeters;
  const maxX = normalized.centerXMeters + halfWidthMeters;
  const minY = normalized.centerYMeters - halfHeightMeters;
  const maxY = normalized.centerYMeters + halfHeightMeters;
  const segments: string[] = [];

  if (showGrid) {
    let lineCount = 0;
    const firstX = Math.ceil(minX / intervalMeters) * intervalMeters;
    for (
      let x = firstX;
      x <= maxX && lineCount < maximumLines;
      x += intervalMeters, lineCount += 1
    ) {
      segments.push(
        `M ${cleanGridNumber(x)} ${cleanGridNumber(minY)} L ${cleanGridNumber(x)} ${cleanGridNumber(maxY)}`,
      );
    }
    const firstY = Math.ceil(minY / intervalMeters) * intervalMeters;
    for (
      let y = firstY;
      y <= maxY && lineCount < maximumLines;
      y += intervalMeters, lineCount += 1
    ) {
      segments.push(
        `M ${cleanGridNumber(minX)} ${cleanGridNumber(y)} L ${cleanGridNumber(maxX)} ${cleanGridNumber(y)}`,
      );
    }
  }

  if (showOrigin) {
    if (minX <= 0 && maxX >= 0)
      segments.push(
        `M 0 ${cleanGridNumber(minY)} L 0 ${cleanGridNumber(maxY)}`,
      );
    if (minY <= 0 && maxY >= 0)
      segments.push(
        `M ${cleanGridNumber(minX)} 0 L ${cleanGridNumber(maxX)} 0`,
      );
  }

  return segments.join(" ");
}

export function buildConsolidatedEdgePath(
  pointsById: ReadonlyMap<string, GridPoint>,
  edges: readonly { sourceId: string; targetId: string }[],
): string {
  return edges
    .map((edge) => {
      const source = pointsById.get(edge.sourceId);
      const target = pointsById.get(edge.targetId);
      if (!source || !target) return "";
      return `M ${cleanGridNumber(source.xMeters)} ${cleanGridNumber(source.yMeters)} L ${cleanGridNumber(target.xMeters)} ${cleanGridNumber(target.yMeters)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function cleanGridNumber(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
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
