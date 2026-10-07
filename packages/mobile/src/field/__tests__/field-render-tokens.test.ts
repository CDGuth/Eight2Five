import {
  FIELD_LABEL_METERS_PER_FONT_UNIT,
  getFixedWorldLabelGapUnits,
  getResponsiveSidelineLabelScale,
} from "../render/field-render-tokens";

describe("responsive sideline label scale", () => {
  test("uses a two-times field-label scale as the default maximum size", () => {
    const scale = getResponsiveSidelineLabelScale(0.25, 0.25, 100, 1000);
    expect(scale).toBeCloseTo(FIELD_LABEL_METERS_PER_FONT_UNIT * 2);
  });

  test("uses the default field-relative size as the maximum screen size", () => {
    const defaultMetersPerPixel = 0.25;
    const defaultScale = getResponsiveSidelineLabelScale(
      defaultMetersPerPixel,
      defaultMetersPerPixel,
      500,
      400,
    );
    const zoomedInScale = getResponsiveSidelineLabelScale(
      0.125,
      defaultMetersPerPixel,
      500,
      400,
    );

    expect(defaultScale / defaultMetersPerPixel).toBeCloseTo(
      zoomedInScale / 0.125,
    );
    expect(zoomedInScale).toBeLessThan(defaultScale);
  });

  test("lets labels shrink naturally when zooming out", () => {
    const defaultMetersPerPixel = 0.25;
    const defaultScale = getResponsiveSidelineLabelScale(
      defaultMetersPerPixel,
      defaultMetersPerPixel,
      500,
      400,
    );
    const zoomedOutScale = getResponsiveSidelineLabelScale(
      0.5,
      defaultMetersPerPixel,
      500,
      400,
    );

    expect(zoomedOutScale).toBeCloseTo(defaultScale);
    expect(zoomedOutScale / 0.5).toBeLessThan(
      defaultScale / defaultMetersPerPixel,
    );
  });

  test("keeps the sideline gap fixed in world space while zooming", () => {
    const defaultMetersPerPixel = 0.25;
    const measuredWidth = 500;
    const viewportWidth = 400;
    const referenceInsetUnits = 96;
    const defaultScale = getResponsiveSidelineLabelScale(
      defaultMetersPerPixel,
      defaultMetersPerPixel,
      measuredWidth,
      viewportWidth,
    );
    const expectedGapMeters = referenceInsetUnits * defaultScale;

    for (const metersPerPixel of [0.125, 0.25, 0.5]) {
      const scale = getResponsiveSidelineLabelScale(
        metersPerPixel,
        defaultMetersPerPixel,
        measuredWidth,
        viewportWidth,
      );
      const gapUnits = getFixedWorldLabelGapUnits(
        scale,
        defaultScale,
        referenceInsetUnits,
      );
      expect(gapUnits * scale).toBeCloseTo(expectedGapMeters);
    }
  });

  test("caps the maximum label width to the viewport", () => {
    const measuredWidth = 1000;
    const viewportWidth = 300;
    const metersPerPixel = 0.2;
    const scale = getResponsiveSidelineLabelScale(
      metersPerPixel,
      metersPerPixel,
      measuredWidth,
      viewportWidth,
    );

    expect((measuredWidth * scale) / metersPerPixel).toBeLessThanOrEqual(
      viewportWidth * 0.82,
    );
  });
});
