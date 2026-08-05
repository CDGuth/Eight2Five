import { getFieldOverlayMetrics } from "../field-overlay-layout";

const insets = { top: 24, right: 10, bottom: 20, left: 10 };

describe("Field overlay layout", () => {
  test("places a safe-area-aware HUD and right live/dial stack in landscape", () => {
    const layout = getFieldOverlayMetrics({
      width: 844,
      height: 390,
      landscape: true,
      insets,
    });

    expect(layout.controlDiameter).toBeGreaterThanOrEqual(140);
    expect(layout.controlDiameter).toBeLessThanOrEqual(164);
    expect(layout.hudStyle.top).toBe(38);
    expect(layout.hudStyle.left).toBe(24);
    expect(layout.hudWidth).toBeGreaterThan(0);
    expect(layout.liveStyle.right).toBe(24);
    expect(layout.dialStyle.right).toBe(24);
    expect(Number(layout.dialStyle.top)).toBe(
      Number(layout.liveStyle.top) + layout.controlDiameter + layout.controlGap,
    );
  });

  test("centers the live/dial pair above the bottom inset in portrait", () => {
    const layout = getFieldOverlayMetrics({
      width: 390,
      height: 844,
      landscape: false,
      insets,
    });

    expect(layout.controlDiameter).toBeGreaterThanOrEqual(140);
    expect(layout.controlDiameter).toBeLessThanOrEqual(156);
    expect(layout.hudStyle.left).toBe(22);
    expect(layout.dialStyle.bottom).toBe(32);
    expect(layout.liveStyle.left).toBe(
      insets.left +
        (390 -
          insets.left -
          insets.right -
          (layout.controlDiameter * 2 + layout.controlGap)) /
          2,
    );
    expect(Number(layout.dialStyle.left)).toBe(
      Number(layout.liveStyle.left) +
        layout.controlDiameter +
        layout.controlGap,
    );
  });

  test("shrinks both portrait controls together on a narrow safe width", () => {
    const layout = getFieldOverlayMetrics({
      width: 360,
      height: 740,
      landscape: false,
      insets: { top: 20, right: 18, bottom: 20, left: 18 },
    });
    const availableWidth = 360 - 18 - 18 - layout.outerPadding * 2;
    expect(layout.controlDiameter * 2 + layout.controlGap).toBeLessThanOrEqual(
      availableWidth,
    );
  });

  test("uses the full safe landscape width for the drill-off live pill", () => {
    const layout = getFieldOverlayMetrics({
      width: 844,
      height: 390,
      landscape: true,
      insets,
      controlPairVisible: false,
    });
    expect(layout.hudWidth).toBe(
      844 - insets.left - insets.right - layout.outerPadding * 2,
    );
  });
});
