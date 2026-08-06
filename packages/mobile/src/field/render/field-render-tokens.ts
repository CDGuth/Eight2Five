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

export const LIVE_POSITION_MARKER_SIZE_STEPS = 1.5;
export const LIVE_POSITION_MARKER_DIAMETER_METERS =
  LIVE_POSITION_MARKER_SIZE_STEPS * STANDARD_STEP_METERS;

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
