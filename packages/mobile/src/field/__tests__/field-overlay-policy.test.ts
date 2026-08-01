import {
  shouldShowFieldGuidance,
  shouldShowFieldTarget,
  type FieldDrillOverlayState,
} from "../render/field-overlay-types";

const visible: FieldDrillOverlayState = {
  drillFeaturesEnabled: true,
  hasActiveDrill: true,
  hasSelectedPage: true,
  hasLivePosition: true,
  guidanceEnabled: true,
};

describe("field drill overlay gating", () => {
  test("shows target and guidance only for a complete active selection", () => {
    expect(shouldShowFieldTarget(visible)).toBe(true);
    expect(shouldShowFieldGuidance(visible)).toBe(true);
  });

  test.each([
    "drillFeaturesEnabled",
    "hasActiveDrill",
    "hasSelectedPage",
  ] as const)("hides target when %s is false", (key) => {
    expect(shouldShowFieldTarget({ ...visible, [key]: false })).toBe(false);
  });

  test("hides guidance without live position or when guidance is disabled", () => {
    expect(
      shouldShowFieldGuidance({ ...visible, hasLivePosition: false }),
    ).toBe(false);
    expect(
      shouldShowFieldGuidance({ ...visible, guidanceEnabled: false }),
    ).toBe(false);
  });
});
