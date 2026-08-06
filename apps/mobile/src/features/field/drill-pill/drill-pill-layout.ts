export interface DrillPillColumnMetrics {
  readonly horizontalPadding: number;
  readonly gap: number;
  readonly setWidth: number;
  readonly countWidth: number;
  readonly metricWidth: number;
  readonly coordinateWidth: number;
}

export function getDrillPillColumnMetrics(
  width: number,
  landscape: boolean,
): DrillPillColumnMetrics {
  const horizontalPadding = width < 380 || landscape ? 10 : 14;
  const gap = width < 380 || landscape ? 6 : 10;
  const contentWidth = Math.max(0, width - horizontalPadding * 2 - gap * 3);
  const setWidth = Math.min(64, Math.max(48, contentWidth * 0.16));
  const countWidth = Math.min(82, Math.max(62, contentWidth * 0.2));
  const metricWidth = Math.min(96, Math.max(72, contentWidth * 0.23));
  return {
    horizontalPadding,
    gap,
    setWidth,
    countWidth,
    metricWidth,
    coordinateWidth: Math.max(
      0,
      contentWidth - setWidth - countWidth - metricWidth,
    ),
  };
}
