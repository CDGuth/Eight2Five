import { createYardNumberTextLayout } from "../render/yard-number-layout";
import { feetToMeters } from "../units";

const bounds = { x: 0.1, y: -0.8, width: 1.4, height: 0.9 };
const targetHeightMeters = feetToMeters(6);

describe("yard-number text layout", () => {
  test("centers measured glyph bounds at an exact six-foot visual height", () => {
    const layout = createYardNumberTextLayout(bounds, targetHeightMeters);
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

    expect((transformedCorners[0].x + transformedCorners[1].x) / 2).toBeCloseTo(
      0,
    );
    expect((transformedCorners[0].y + transformedCorners[1].y) / 2).toBeCloseTo(
      0,
    );
    expect(layout.visualHeightMeters).toBeCloseTo(targetHeightMeters);
    expect(
      Math.abs(transformedCorners[1].y - transformedCorners[0].y),
    ).toBeCloseTo(targetHeightMeters);
  });

  test("counteracts the field Y reflection so every row is upright to the viewer", () => {
    const layout = createYardNumberTextLayout(bounds, targetHeightMeters);

    expect(layout.scaleX).toBeGreaterThan(0);
    expect(layout.scaleY).toBeLessThan(0);

    // FieldScene applies scaleY(-1). Combining that with this local Y
    // reflection produces an ordinary positive-X/positive-Y screen transform.
    expect({ x: layout.scaleX, y: -layout.scaleY }).toEqual({
      x: Math.abs(layout.scaleX),
      y: Math.abs(layout.scaleY),
    });
  });

  test("rejects unusable visual bounds", () => {
    expect(() =>
      createYardNumberTextLayout({ ...bounds, height: 0 }, targetHeightMeters),
    ).toThrow(RangeError);
  });
});
