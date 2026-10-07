import { getDrillPillColumnMetrics } from "../drill-pill-layout";

describe("drill pill layout", () => {
  test.each([
    [360, false],
    [390, false],
    [600, true],
  ])("prioritizes a usable coordinate column at %ipx", (width, landscape) => {
    const metrics = getDrillPillColumnMetrics(width, landscape);
    const used =
      metrics.horizontalPadding * 2 +
      metrics.setToCountGap +
      metrics.countToMetricGap +
      metrics.metricToCoordinateGap +
      metrics.setWidth +
      metrics.countWidth +
      metrics.metricWidth +
      metrics.coordinateWidth;
    expect(used).toBeCloseTo(width);
    expect(metrics.coordinateWidth).toBeGreaterThanOrEqual(100);
  });

  test("scales visual typography from the iPhone 16e reference width with clamps", () => {
    expect(getDrillPillColumnMetrics(366, false).visualScale).toBe(1);
    expect(getDrillPillColumnMetrics(300, false).visualScale).toBe(0.85);
    expect(getDrillPillColumnMetrics(500, false).visualScale).toBe(1.15);
  });

  test("redistributes portrait step-size width into left spacing without moving coordinates", () => {
    const metrics = getDrillPillColumnMetrics(390, false);
    const coordinateStart =
      metrics.horizontalPadding +
      metrics.setWidth +
      metrics.setToCountGap +
      metrics.countWidth +
      metrics.countToMetricGap +
      metrics.metricWidth +
      metrics.metricToCoordinateGap;

    expect(metrics.setToCountGap).toBe(8);
    expect(metrics.setWidth).toBeLessThanOrEqual(28);
    expect(metrics.countToMetricGap).toBe(8);
    expect(metrics.metricWidth).toBeLessThan(80);
    expect(metrics.metricToCoordinateGap).toBe(4);
    expect(metrics.coordinateChevronGap).toBe(10);
    expect(coordinateStart).toBeCloseTo(203.74);
    expect(metrics.coordinateWidth).toBeGreaterThan(160);
  });

  test("preserves the landscape spacing model", () => {
    const metrics = getDrillPillColumnMetrics(600, true);
    expect(metrics.setToCountGap).toBe(6);
    expect(metrics.countToMetricGap).toBe(6);
    expect(metrics.metricToCoordinateGap).toBe(6);
    expect(metrics.coordinateChevronGap).toBe(6);
  });
});
