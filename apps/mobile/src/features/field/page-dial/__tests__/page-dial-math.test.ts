import {
  getPageDialCardinalPoints,
  getPageDialDividerSegments,
  getPageDialRingHitRegion,
  pageDialAngleIsInValidArc,
  pageDialIndexForProgress,
  pageDialPointForProgress,
  pageDialPointIsInRingHitRegion,
  pageDialProgressForAngle,
  pageDialProgressForPoint,
  pageDialProgressForPointNearReference,
  PAGE_DIAL_START_ANGLE_DEGREES,
  PAGE_DIAL_USABLE_ARC_DEGREES,
  normalizePageIndex,
  pageDialAngleForIndex,
  pageDialIndexForAngle,
} from "../page-dial-math";
import {
  getPageDialAccessibilityLabel,
  getPageDialControlState,
  getPageDialProportions,
} from "../page-dial-layout";

const radians = (degrees: number) => (degrees * Math.PI) / 180;

describe("page dial math", () => {
  test("maps first and last pages to the shared top endpoint", () => {
    expect(normalizePageIndex(0, 38)).toBe(0);
    expect(normalizePageIndex(37, 38)).toBe(1);
    expect(pageDialAngleForIndex(0, 38)).toBeCloseTo(
      radians(PAGE_DIAL_START_ANGLE_DEGREES),
    );
    expect(pageDialAngleForIndex(37, 38)).toBeCloseTo(
      radians(PAGE_DIAL_START_ANGLE_DEGREES + PAGE_DIAL_USABLE_ARC_DEGREES),
    );
    const first = pageDialPointForProgress(0, 200);
    const last = pageDialPointForProgress(1, 200);
    expect(first.x).toBeCloseTo(last.x);
    expect(first.y).toBeCloseTo(last.y);
  });

  test("uses drag history to disambiguate the shared top endpoint", () => {
    const diameter = 200;
    const center = diameter / 2;
    const topY = center - 90;
    expect(
      pageDialProgressForPointNearReference(center, topY, diameter, 0.02),
    ).toBe(0);
    expect(
      pageDialProgressForPointNearReference(center, topY, diameter, 0.98),
    ).toBe(1);

    const clockwisePastTop = pageDialPointForProgress(0.01, diameter, 90);
    expect(
      pageDialProgressForPointNearReference(
        clockwisePastTop.x,
        clockwisePastTop.y,
        diameter,
        1,
      ),
    ).toBeCloseTo(0.01);

    const counterClockwisePastTop = pageDialPointForProgress(
      0.99,
      diameter,
      90,
    );
    expect(
      pageDialProgressForPointNearReference(
        counterClockwisePastTop.x,
        counterClockwisePastTop.y,
        diameter,
        0,
      ),
    ).toBeCloseTo(0.99);

    expect(pageDialIndexForAngle(radians(-89), 38)).toBe(0);
    expect(pageDialIndexForAngle(radians(-91), 38)).toBe(37);
    expect(pageDialIndexForAngle(radians(90), 5)).toBe(2);
  });

  test("keeps cardinal angles on one continuous full circle", () => {
    expect(pageDialProgressForAngle(radians(0))).toBeCloseTo(0.25);
    expect(pageDialProgressForAngle(radians(90))).toBeCloseTo(0.5);
    expect(pageDialProgressForAngle(radians(180))).toBeCloseTo(0.75);
    expect(pageDialAngleIsInValidArc(radians(-90))).toBe(true);
    expect(pageDialAngleIsInValidArc(radians(270))).toBe(true);
    expect(pageDialIndexForProgress(0.5, 5)).toBe(2);
  });

  test("accepts an enlarged radial ring hit region but not its center", () => {
    const diameter = 200;
    const center = diameter / 2;
    const region = getPageDialRingHitRegion(diameter);
    expect(
      pageDialPointIsInRingHitRegion(
        center + region.innerRadius - 0.1,
        center,
        diameter,
      ),
    ).toBe(false);
    expect(
      pageDialPointIsInRingHitRegion(
        center + (region.innerRadius + region.outerRadius) / 2,
        center,
        diameter,
      ),
    ).toBe(true);
    expect(
      pageDialPointIsInRingHitRegion(
        center + region.outerRadius + 0.1,
        center,
        diameter,
      ),
    ).toBe(false);
    expect(pageDialProgressForPoint(center, center, diameter)).toBe(0);
  });

  test("disables unavailable first and last actions", () => {
    expect(getPageDialControlState(0, 4)).toEqual({
      previousDisabled: true,
      nextDisabled: false,
    });
    expect(getPageDialControlState(3, 4)).toEqual({
      previousDisabled: false,
      nextDisabled: true,
    });
    expect(getPageDialControlState(-1, 4)).toEqual({
      previousDisabled: true,
      nextDisabled: false,
    });
  });

  test("uses supplied proportions and terminology-aware accessibility", () => {
    const proportions = getPageDialProportions(100);
    expect(proportions.ringThickness).toBeCloseTo(7.5);
    expect(proportions.innerDiskDiameter).toBeCloseTo(86);
    expect(proportions.centerDiskDiameter).toBeCloseTo(30);
    expect(proportions.centerBorderWidth).toBe(0);
    expect(proportions.knobDiameter).toBeCloseTo(16);
    expect(proportions.controlCenterOffset).toBeCloseTo(29);
    expect(proportions.controlButtonSize).toBeGreaterThanOrEqual(44);
    expect(proportions.canvasOverscan).toBeGreaterThan(proportions.knobRadius);
    expect(
      getPageDialAccessibilityLabel({
        selectedIndex: 21,
        selectedLabel: "22",
        pageCount: 38,
        terminology: "sets",
      }),
    ).toBe("Set selector, set 22 of 38");
  });

  test("places controls at four equal cardinal points and keeps the knob in overscan", () => {
    const diameter = 200;
    const points = getPageDialCardinalPoints(diameter);
    const center = diameter / 2;
    const distances = [
      Math.hypot(points.top.x - center, points.top.y - center),
      Math.hypot(points.right.x - center, points.right.y - center),
      Math.hypot(points.bottom.x - center, points.bottom.y - center),
      Math.hypot(points.left.x - center, points.left.y - center),
    ];
    distances.forEach((distance) => expect(distance).toBeCloseTo(distances[0]));

    const proportions = getPageDialProportions(diameter);
    const knob = pageDialPointForProgress(0, diameter, proportions.ringRadius);
    expect(knob.x - proportions.knobRadius).toBeGreaterThanOrEqual(
      -proportions.canvasOverscan,
    );
    expect(knob.y - proportions.knobRadius).toBeGreaterThanOrEqual(
      -proportions.canvasOverscan,
    );
    expect(getPageDialDividerSegments(diameter)).toHaveLength(4);
  });
});
