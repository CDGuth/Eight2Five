const DRILL_PILL_REFERENCE_WIDTH = 366;
const MIN_VISUAL_SCALE = 0.85;
const MAX_VISUAL_SCALE = 1.15;

export interface DrillPillColumnMetrics {
  readonly visualScale: number;
  readonly horizontalPadding: number;
  readonly setToCountGap: number;
  readonly countToMetricGap: number;
  readonly metricToCoordinateGap: number;
  readonly coordinateChevronGap: number;
  readonly setWidth: number;
  readonly countWidth: number;
  readonly metricWidth: number;
  readonly coordinateWidth: number;
}

export function getDrillPillColumnMetrics(
  width: number,
  landscape: boolean,
): DrillPillColumnMetrics {
  const compact = width < 380 || landscape;
  const visualScale = Math.min(
    MAX_VISUAL_SCALE,
    Math.max(MIN_VISUAL_SCALE, width / DRILL_PILL_REFERENCE_WIDTH),
  );
  const horizontalPadding = compact ? 10 : 14;
  const baseGap = compact ? 6 : 10;
  const portraitSizingGap = 5;
  const portraitLeftGap = 8;
  const portraitCoordinateGap = 4;
  const setToCountGap = landscape ? baseGap : portraitLeftGap;
  const countToMetricGap = landscape ? baseGap : portraitLeftGap;
  const metricToCoordinateGap = landscape ? baseGap : portraitCoordinateGap;
  const coordinateChevronGap = landscape ? 6 : 10;
  const totalGaps = setToCountGap + countToMetricGap + metricToCoordinateGap;
  const sizingGaps = landscape
    ? totalGaps
    : portraitSizingGap * 2 + portraitCoordinateGap;
  const sizingContentWidth = Math.max(
    0,
    width - horizontalPadding * 2 - sizingGaps,
  );
  const setWidth = landscape
    ? Math.min(64, Math.max(48, sizingContentWidth * 0.16))
    : Math.min(28, Math.max(24, sizingContentWidth * 0.075));
  const countWidth = Math.min(82, Math.max(62, sizingContentWidth * 0.2));
  const baseMetricWidth = Math.min(96, Math.max(72, sizingContentWidth * 0.23));
  const metricWidth = landscape
    ? baseMetricWidth
    : Math.max(0, baseMetricWidth - (portraitLeftGap - portraitSizingGap) * 2);
  return {
    visualScale,
    horizontalPadding,
    setToCountGap,
    countToMetricGap,
    metricToCoordinateGap,
    coordinateChevronGap,
    setWidth,
    countWidth,
    metricWidth,
    coordinateWidth: Math.max(
      0,
      width -
        horizontalPadding * 2 -
        totalGaps -
        setWidth -
        countWidth -
        metricWidth,
    ),
  };
}
