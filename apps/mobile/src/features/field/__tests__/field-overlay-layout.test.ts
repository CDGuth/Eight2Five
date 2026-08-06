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
    expect(layout.liveStyle.right).toBe(10);
    expect(layout.dialStyle.right).toBe(10);
    const topGap = Number(layout.liveStyle.top) - insets.top;
    const betweenGap =
      Number(layout.dialStyle.top) -
      (Number(layout.liveStyle.top) + layout.controlDiameter);
    const bottomGap =
      390 -
      insets.bottom -
      (Number(layout.dialStyle.top) + layout.controlDiameter);
    expect(topGap).toBeCloseTo(layout.controlGap);
    expect(betweenGap).toBeCloseTo(layout.controlGap);
    expect(bottomGap).toBeCloseTo(layout.controlGap);
  });

  test("caps the landscape right margin when the safe-area inset is large", () => {
    const layout = getFieldOverlayMetrics({
      width: 844,
      height: 390,
      landscape: true,
      insets: { top: 24, right: 48, bottom: 20, left: 10 },
    });

    expect(layout.liveStyle.right).toBe(layout.outerPadding);
    expect(layout.dialStyle.right).toBe(layout.outerPadding);
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
    const leftGap = Number(layout.liveStyle.left) - insets.left;
    const betweenGap =
      Number(layout.dialStyle.left) -
      (Number(layout.liveStyle.left) + layout.controlDiameter);
    const rightGap =
      390 -
      insets.right -
      (Number(layout.dialStyle.left) + layout.controlDiameter);
    expect(leftGap).toBeCloseTo(layout.controlGap);
    expect(betweenGap).toBeCloseTo(layout.controlGap);
    expect(rightGap).toBeCloseTo(layout.controlGap);
    expect(layout.dialStyle.bottom).toBe(insets.bottom + layout.controlGap);
  });

  test("shrinks both portrait controls together on a narrow safe width", () => {
    const layout = getFieldOverlayMetrics({
      width: 360,
      height: 740,
      landscape: false,
      insets: { top: 20, right: 18, bottom: 20, left: 18 },
    });
    const safeWidth = 360 - 18 - 18;
    expect(layout.controlDiameter * 2 + layout.controlGap * 3).toBeCloseTo(
      safeWidth,
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
