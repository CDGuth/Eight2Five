import { COLOR_PRESETS } from "@eight2five/drill-schema";

import { STANDARD_STEP_METERS } from "../units";

export const FIELD_FOUR_STEP_GRID_COLOR = "#6FA0E1";

function colorWithOpacity(color: `#${string}`, opacity: number): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export interface FieldRenderPalette {
  readonly canvasBackground: string;
  readonly stepGrid: string;
  readonly fieldBackground: string;
  readonly fourStepGrid: string;
  readonly fieldLines: string;
  readonly fieldNumbers: string;
  readonly livePosition: string;
  readonly guidance: string;
  readonly anchor: string;
  readonly anchorRange: string;
}

/** Schema-synchronized colors used by the selected performer's markers. */
export const DRILL_MARKER_COLORS = Object.freeze({
  yellow: COLOR_PRESETS.yellow,
  red: COLOR_PRESETS.red,
  green: COLOR_PRESETS.green,
});

/** Marker diameters are physical sizes expressed in standard 8:5 steps. */
export const DRILL_MARKER_SIZE_STEPS = Object.freeze({
  currentDiameter: 2,
  transitionDiameter: 1,
  midpointDiameter: 0.5,
});

/** World-space diameters used by the renderer so markers stay locked to the grid. */
export const DRILL_MARKER_SIZE_METERS = Object.freeze({
  currentDiameter:
    DRILL_MARKER_SIZE_STEPS.currentDiameter * STANDARD_STEP_METERS,
  transitionDiameter:
    DRILL_MARKER_SIZE_STEPS.transitionDiameter * STANDARD_STEP_METERS,
  midpointDiameter:
    DRILL_MARKER_SIZE_STEPS.midpointDiameter * STANDARD_STEP_METERS,
});

/** Converts Skia text font units into fixed world-space meters. */
export const FIELD_LABEL_METERS_PER_FONT_UNIT = STANDARD_STEP_METERS / 24;
export const FIELD_LABEL_MIN_SCREEN_FONT_SIZE_PX = 10;
export const FIELD_LABEL_MAX_SCREEN_FONT_SIZE_PX = 36;
export const STICKY_YARD_NUMBER_MIN_HEIGHT_PX = 14;
export const STICKY_YARD_NUMBER_MAX_HEIGHT_PX = 48;
export const STICKY_YARD_NUMBER_BOTTOM_INSET_PX = 12;
export const FIELD_NUMBER_OPACITY = 0.72;
export const FIELD_CONNECTOR_STROKE_PX = 1.25;

/**
 * Sideline labels are deliberately larger than ordinary entity labels. Their
 * normal field-space size is the maximum apparent size: zooming in reduces the
 * world-space scale so the label never grows beyond that default screen size.
 */
export function getResponsiveSidelineLabelScale(
  metersPerPixel: number,
  defaultMetersPerPixel: number,
  measuredWidthUnits: number,
  viewportWidthPx: number,
): number {
  "worklet";
  const baseScale = (0.5715 / 24) * 2;
  if (
    !Number.isFinite(metersPerPixel) ||
    metersPerPixel <= 0 ||
    !Number.isFinite(defaultMetersPerPixel) ||
    defaultMetersPerPixel <= 0 ||
    !Number.isFinite(measuredWidthUnits) ||
    measuredWidthUnits <= 0 ||
    !Number.isFinite(viewportWidthPx) ||
    viewportWidthPx <= 0
  ) {
    return baseScale;
  }

  const defaultScreenScale = baseScale / defaultMetersPerPixel;
  const widthLimitedScreenScale = (viewportWidthPx * 0.82) / measuredWidthUnits;
  const maximumScreenScale = Math.min(
    defaultScreenScale,
    widthLimitedScreenScale,
  );

  return Math.min(baseScale, metersPerPixel * maximumScreenScale);
}

/**
 * Convert a reference local inset into local units that preserve one fixed
 * world-space gap. This keeps label-to-field spacing locked to the marching
 * grid instead of changing as the camera zoom changes.
 */
export function getFixedWorldLabelGapUnits(
  labelScale: number,
  defaultLabelScale: number,
  referenceInsetUnits: number,
): number {
  "worklet";
  if (
    !Number.isFinite(labelScale) ||
    labelScale <= 0 ||
    !Number.isFinite(defaultLabelScale) ||
    defaultLabelScale <= 0 ||
    !Number.isFinite(referenceInsetUnits) ||
    referenceInsetUnits < 0
  ) {
    return referenceInsetUnits;
  }
  const referenceGapMeters = referenceInsetUnits * defaultLabelScale;
  return referenceGapMeters / labelScale;
}

/**
 * Preserve field-relative text scaling until it would become illegibly small
 * or dominate the screen, then clamp its apparent screen-space font size.
 */
export function getClampedFieldTextScale(
  metersPerPixel: number,
  referenceFontSizePx: number,
  minimumScreenFontSizePx = 10,
  maximumScreenFontSizePx = 36,
): number {
  "worklet";
  const baseScale = 0.5715 / 24;
  if (
    !Number.isFinite(metersPerPixel) ||
    metersPerPixel <= 0 ||
    !Number.isFinite(referenceFontSizePx) ||
    referenceFontSizePx <= 0
  ) {
    return baseScale;
  }
  const minimumScale =
    (metersPerPixel * minimumScreenFontSizePx) / referenceFontSizePx;
  const maximumScale =
    (metersPerPixel * maximumScreenFontSizePx) / referenceFontSizePx;
  return Math.min(maximumScale, Math.max(minimumScale, baseScale));
}

export const LIVE_POSITION_MARKER_SIZE_STEPS =
  DRILL_MARKER_SIZE_STEPS.transitionDiameter;
export const LIVE_POSITION_MARKER_DIAMETER_METERS =
  DRILL_MARKER_SIZE_METERS.transitionDiameter;

export const DEFAULT_FIELD_RENDER_PALETTE: FieldRenderPalette = Object.freeze({
  canvasBackground: "#E7EAF0",
  stepGrid: "rgba(76, 93, 120, 0.22)",
  fieldBackground: "rgba(247, 249, 252, 0.90)",
  fourStepGrid: FIELD_FOUR_STEP_GRID_COLOR,
  fieldLines: "#5D6470",
  fieldNumbers: "#69717D",
  livePosition: COLOR_PRESETS.blue,
  guidance: colorWithOpacity(COLOR_PRESETS.blue, 0.74),
  anchor: "#7B5CC7",
  anchorRange: "rgba(123, 92, 199, 0.14)",
});
