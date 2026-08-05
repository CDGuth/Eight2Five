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
      metrics.gap * 3 +
      metrics.setWidth +
      metrics.countWidth +
      metrics.metricWidth +
      metrics.coordinateWidth;
    expect(used).toBeCloseTo(width);
    expect(metrics.coordinateWidth).toBeGreaterThanOrEqual(100);
  });
});
