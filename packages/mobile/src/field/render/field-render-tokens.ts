import { COLOR_PRESETS } from "@eight2five/drill-schema";

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
  readonly target: string;
  readonly guidance: string;
  readonly anchor: string;
  readonly anchorRange: string;
}

export const DEFAULT_FIELD_RENDER_PALETTE: FieldRenderPalette = Object.freeze({
  canvasBackground: "#E7EAF0",
  stepGrid: "rgba(76, 93, 120, 0.22)",
  fieldBackground: "rgba(247, 249, 252, 0.90)",
  fourStepGrid: FIELD_FOUR_STEP_GRID_COLOR,
  fieldLines: "#5D6470",
  fieldNumbers: "#69717D",
  livePosition: COLOR_PRESETS.blue,
  target: "#D29B22",
  guidance: colorWithOpacity(COLOR_PRESETS.blue, 0.74),
  anchor: "#7B5CC7",
  anchorRange: "rgba(123, 92, 199, 0.14)",
});
