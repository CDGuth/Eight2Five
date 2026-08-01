import { getFieldOverlayMetrics } from "../field-overlay-layout";

const insets = { top: 24, right: 10, bottom: 20, left: 10 };

describe("Field overlay layout", () => {
  test("places a safe-area-aware HUD and right-side dial in landscape", () => {
    const layout = getFieldOverlayMetrics({
      width: 844,
      height: 390,
      landscape: true,
      insets,
    });

    expect(layout.dialDiameter).toBeGreaterThanOrEqual(148);
    expect(layout.dialDiameter).toBeLessThanOrEqual(172);
    expect(layout.hudStyle.top).toBe(40);
    expect(layout.hudStyle.left).toBe(26);
    expect(layout.hudStyle.width).toBeLessThanOrEqual(844 * 0.72);
    expect(layout.dialStyle.right).toBe(26);
  });

  test("centers the dial above the bottom inset and expands the HUD in portrait", () => {
    const layout = getFieldOverlayMetrics({
      width: 390,
      height: 844,
      landscape: false,
      insets,
    });

    expect(layout.dialDiameter).toBeGreaterThanOrEqual(140);
    expect(layout.dialDiameter).toBeLessThanOrEqual(156);
    expect(layout.hudStyle.left).toBe(22);
    expect(layout.hudStyle.right).toBe(22);
    expect(layout.dialStyle.bottom).toBe(32);
    expect(layout.dialStyle.left).toBe((390 - layout.dialDiameter) / 2);
  });
});
