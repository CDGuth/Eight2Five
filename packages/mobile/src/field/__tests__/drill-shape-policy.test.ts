import {
  createDrillShapeGeometry,
  getDrillLabelTransformPolicy,
  getDrillLabelVerticalOffsetUnits,
  getDrillShapeTransformPolicy,
  PERFORMER_LABEL_GAP_METERS,
} from "../render/drill-shape-policy";
import { FIELD_LABEL_METERS_PER_FONT_UNIT } from "../render/field-render-tokens";

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

  test("keeps labels at a fixed field-space scale for both perspectives", () => {
    expect(getDrillLabelTransformPolicy("director")).toEqual({
      scaleX: FIELD_LABEL_METERS_PER_FONT_UNIT,
      scaleY: -FIELD_LABEL_METERS_PER_FONT_UNIT,
    });
    expect(getDrillLabelTransformPolicy("performer")).toEqual({
      scaleX: -FIELD_LABEL_METERS_PER_FONT_UNIT,
      scaleY: FIELD_LABEL_METERS_PER_FONT_UNIT,
    });
  });

  test("keeps performer-label spacing fixed relative to the field grid", () => {
    const markerHalfHeightMeters = 0.28575;
    const paintedBottomUnits = -14;

    for (const labelScale of [0.02, 0.06, 0.1, 0.25]) {
      const offsetUnits = getDrillLabelVerticalOffsetUnits(
        labelScale,
        markerHalfHeightMeters,
        paintedBottomUnits,
      );
      const labelBottomMeters = (paintedBottomUnits + offsetUnits) * labelScale;
      const markerTopMeters = -markerHalfHeightMeters;
      expect(markerTopMeters - labelBottomMeters).toBeCloseTo(
        PERFORMER_LABEL_GAP_METERS,
      );
    }
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
