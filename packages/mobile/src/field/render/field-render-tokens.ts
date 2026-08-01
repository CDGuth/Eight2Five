export const FIELD_FIVE_YARD_GRID_COLOR = "#6FA0E1";

export interface FieldRenderPalette {
  readonly canvasBackground: string;
  readonly stepGrid: string;
  readonly fieldBackground: string;
  readonly fiveYardGrid: string;
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
  fiveYardGrid: FIELD_FIVE_YARD_GRID_COLOR,
  fieldLines: "#5D6470",
  fieldNumbers: "#69717D",
  livePosition: "#3C6EC8",
  target: "#D29B22",
  guidance: "rgba(60, 110, 200, 0.74)",
  anchor: "#7B5CC7",
  anchorRange: "rgba(123, 92, 199, 0.14)",
});
