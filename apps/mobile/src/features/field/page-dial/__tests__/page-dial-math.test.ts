import {
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
  test("maps first and last pages to distinct arc endpoints", () => {
    expect(normalizePageIndex(0, 38)).toBe(0);
    expect(normalizePageIndex(37, 38)).toBe(1);
    expect(pageDialAngleForIndex(0, 38)).toBeCloseTo(
      radians(PAGE_DIAL_START_ANGLE_DEGREES),
    );
    expect(pageDialAngleForIndex(37, 38)).toBeCloseTo(
      radians(PAGE_DIAL_START_ANGLE_DEGREES + PAGE_DIAL_USABLE_ARC_DEGREES),
    );
  });

  test("clamps either side of the top seam to the nearest endpoint", () => {
    expect(pageDialIndexForAngle(radians(-89), 38)).toBe(0);
    expect(pageDialIndexForAngle(radians(-91), 38)).toBe(37);
    expect(pageDialIndexForAngle(radians(90), 5)).toBe(2);
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
    expect(proportions.ringThickness).toBeCloseTo(7);
    expect(proportions.innerDiskDiameter).toBeCloseTo(86);
    expect(proportions.centerDiskDiameter).toBeCloseTo(30);
    expect(proportions.centerBorderWidth).toBeCloseTo(1.8);
    expect(proportions.knobDiameter).toBeCloseTo(13);
    expect(proportions.controlCenterOffset).toBeCloseTo(29);
    expect(
      getPageDialAccessibilityLabel({
        selectedIndex: 21,
        selectedLabel: "22",
        pageCount: 38,
        terminology: "sets",
      }),
    ).toBe("Set selector, set 22 of 38");
  });
});
