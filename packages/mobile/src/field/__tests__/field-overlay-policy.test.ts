import {
  getCurrentTargetMarkerSource,
  resolveCurrentTargetPosition,
  shouldShowFieldGuidance,
  shouldShowFieldGuidanceForScene,
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

  test("does not fall back to a stale target when a complete scene has no current position", () => {
    const target = { xMeters: 1, yMeters: 2 };
    const sceneWithoutCurrent = {
      fullDrillSceneAvailable: true,
      sceneHasCurrent: false,
      legacyFallbackAvailable: true,
    } as const;

    expect(getCurrentTargetMarkerSource(sceneWithoutCurrent)).toBe("none");
    expect(
      resolveCurrentTargetPosition({
        fullDrillSceneAvailable: true,
        sceneCurrent: null,
        legacyFallback: target,
      }),
    ).toBeUndefined();
    expect(shouldShowFieldGuidanceForScene(visible, sceneWithoutCurrent)).toBe(
      false,
    );
  });

  test("keeps legacy/manual target and guidance behavior without a full scene", () => {
    const target = { xMeters: 1, yMeters: 2 };
    const legacy = {
      fullDrillSceneAvailable: false,
      sceneHasCurrent: false,
      legacyFallbackAvailable: true,
    } as const;

    expect(getCurrentTargetMarkerSource(legacy)).toBe("legacy-fallback");
    expect(
      resolveCurrentTargetPosition({
        fullDrillSceneAvailable: false,
        sceneCurrent: undefined,
        legacyFallback: target,
      }),
    ).toEqual(target);
    expect(shouldShowFieldGuidanceForScene(visible, legacy)).toBe(true);
  });

  test("uses the complete scene target when both scene and fallback positions exist", () => {
    const sceneTarget = { xMeters: 3, yMeters: 4 };
    const fallbackTarget = { xMeters: 1, yMeters: 2 };
    expect(
      resolveCurrentTargetPosition({
        fullDrillSceneAvailable: true,
        sceneCurrent: sceneTarget,
        legacyFallback: fallbackTarget,
      }),
    ).toBe(sceneTarget);
  });
});
