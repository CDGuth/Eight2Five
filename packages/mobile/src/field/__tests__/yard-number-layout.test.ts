import { createYardNumberTextLayout } from "../render/yard-number-layout";
import { feetToMeters } from "../units";

const bounds = { x: 0.1, y: -0.8, width: 1.4, height: 0.9 };
const targetHeightMeters = feetToMeters(6);

describe("yard-number text layout", () => {
  test.each(["front", "back"] as const)(
    "centers measured %s glyph bounds at an exact six-foot visual height",
    (side) => {
      const layout = createYardNumberTextLayout(
        bounds,
        targetHeightMeters,
        side,
      );
      const transformedCorners = [
        {
          x: (layout.x + bounds.x) * layout.scaleX,
          y: (layout.y + bounds.y) * layout.scaleY,
        },
        {
          x: (layout.x + bounds.x + bounds.width) * layout.scaleX,
          y: (layout.y + bounds.y + bounds.height) * layout.scaleY,
        },
      ];

      expect(
        (transformedCorners[0].x + transformedCorners[1].x) / 2,
      ).toBeCloseTo(0);
      expect(
        (transformedCorners[0].y + transformedCorners[1].y) / 2,
      ).toBeCloseTo(0);
      expect(layout.visualHeightMeters).toBeCloseTo(targetHeightMeters);
      expect(
        Math.abs(transformedCorners[1].y - transformedCorners[0].y),
      ).toBeCloseTo(targetHeightMeters);
    },
  );

  test("faces the front and back rows toward opposite sidelines", () => {
    const front = createYardNumberTextLayout(
      bounds,
      targetHeightMeters,
      "front",
    );
    const back = createYardNumberTextLayout(bounds, targetHeightMeters, "back");

    expect(front.scaleX).toBeGreaterThan(0);
    expect(front.scaleY).toBeLessThan(0);
    expect(back.scaleX).toBeLessThan(0);
    expect(back.scaleY).toBeGreaterThan(0);

    // FieldScene reflects world Y into screen Y. The front row is upright on
    // screen; the back row is rotated 180 degrees to face the back sideline.
    expect({ x: front.scaleX, y: -front.scaleY }).toEqual({
      x: Math.abs(front.scaleX),
      y: Math.abs(front.scaleY),
    });
    expect({ x: back.scaleX, y: -back.scaleY }).toEqual({
      x: -Math.abs(back.scaleX),
      y: -Math.abs(back.scaleY),
    });
  });

  test("rejects unusable visual bounds", () => {
    expect(() =>
      createYardNumberTextLayout(
        { ...bounds, height: 0 },
        targetHeightMeters,
        "front",
      ),
    ).toThrow(RangeError);
  });
});
