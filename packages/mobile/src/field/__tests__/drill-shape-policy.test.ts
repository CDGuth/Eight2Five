import {
  createDrillShapeGeometry,
  getDrillLabelTransformPolicy,
  getDrillShapeTransformPolicy,
} from "../render/drill-shape-policy";

describe("drill icon shape policy", () => {
  test.each([
    "square",
    "triangle",
    "diamond",
    "star",
    "hexagon",
    "cross",
  ] as const)("covers the %s path primitive", (icon) => {
    const shape = createDrillShapeGeometry(icon, 2, 2);
    expect(shape.kind).toBe("path");
    if (shape.kind === "path") expect(shape.points.length).toBeGreaterThan(2);
  });

  test("triangle points upward in world coordinates despite camera scaleY(-1)", () => {
    const shape = createDrillShapeGeometry("triangle", 2, 2);
    expect(shape).toMatchObject({ kind: "path" });
    if (shape.kind !== "path") return;

    expect(shape.points[0]).toEqual({ x: 0, y: 1 });
    expect(shape.points[1].y).toBe(-1);
    expect(shape.points[2].y).toBe(-1);
  });

  test("star's first point is the upright directional point rather than a mirrored bottom point", () => {
    const shape = createDrillShapeGeometry("star", 2, 2);
    expect(shape.kind).toBe("path");
    if (shape.kind !== "path") return;

    const highestWorldY = Math.max(...shape.points.map((point) => point.y));
    expect(shape.points[0].y).toBe(highestWorldY);
    expect(shape.points[0].x).toBeCloseTo(0);
    expect(shape.points[0].y).toBeCloseTo(1);
  });

  test("negates field facing rotation for the reflected camera while retaining radians", () => {
    expect(getDrillShapeTransformPolicy()).toMatchObject({
      rotationRadians: 0,
      origin: { x: 0, y: 0 },
    });
    expect(getDrillShapeTransformPolicy(90).rotationRadians).toBeCloseTo(
      -Math.PI / 2,
    );
    expect(getDrillShapeTransformPolicy(180).rotationRadians).toBeCloseTo(
      -Math.PI,
    );
  });

  test("uses opposite Y scaling for screen-constant upright labels", () => {
    expect(getDrillLabelTransformPolicy(0.25)).toEqual({
      scaleX: 0.25,
      scaleY: -0.25,
    });
  });

  test("keeps dot and circle primitives circular", () => {
    expect(createDrillShapeGeometry("dot", 2, 4)).toEqual({
      kind: "circle",
      radius: 1,
    });
    expect(createDrillShapeGeometry("circle", 2, 4)).toEqual({
      kind: "circle",
      radius: 1,
    });
  });
});
