import type { FieldPresetId } from "@eight2five/drill-schema";
import {
  drillGridPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
} from "@eight2five/mobile/field";
import {
  formatSetName,
  getDrillTerms,
  type DrillSet,
  type DrillTerminology,
} from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import { getTransitionPresentation } from "../drill/transition-presentation";

export type { CountDisplayMode } from "@eight2five/mobile/settings";

export interface FieldHudState {
  readonly drillPillExpanded: boolean;
}

export type FieldHudAction =
  | { readonly type: "toggle-drill-pill" }
  | { readonly type: "collapse-drill-pill" };

export const INITIAL_FIELD_HUD_STATE: FieldHudState = Object.freeze({
  drillPillExpanded: false,
});

export function reduceFieldHudState(
  state: FieldHudState,
  action: FieldHudAction,
): FieldHudState {
  switch (action.type) {
    case "toggle-drill-pill":
      return { ...state, drillPillExpanded: !state.drillPillExpanded };
    case "collapse-drill-pill":
      return state.drillPillExpanded
        ? { ...state, drillPillExpanded: false }
        : state;
  }
}

export interface CoordinateLines {
  readonly side: string;
  readonly frontBack: string;
}

export interface DrillSetHudPresentation {
  readonly term: "Page" | "Set";
  readonly set: string;
  readonly counts: string;
  readonly measures: string;
  readonly metricLabel: "Step Size" | "xCounts";
  readonly metric: string;
  readonly coordinate: CoordinateLines | null;
  readonly emptyMessage?: string;
}

export function formatDrillCoordinateLines(
  position: DrillSet["position"],
  fieldPreset: FieldPresetId = "football-nfhs",
): CoordinateLines {
  const coordinate = drillGridPointToMarchingCoordinate(position, fieldPreset);
  return {
    side: formatMarchingSide(coordinate.side),
    frontBack: formatMarchingFrontBack(coordinate.frontBack, fieldPreset),
  };
}

export function getDrillSetHudPresentation({
  page,
  previousPage,
  metricMode,
  fieldPreset = "football-nfhs",
  terminology,
}: {
  readonly page?: DrillSet;
  readonly previousPage?: DrillSet;
  readonly metricMode: TransitionMetricMode;
  readonly fieldPreset?: FieldPresetId;
  readonly terminology: DrillTerminology;
}): DrillSetHudPresentation {
  const terms = getDrillTerms(terminology);
  const metricLabel = metricMode === "step-size" ? "Step Size" : "xCounts";
  if (!page) {
    return {
      term: terms.singular,
      set: "–",
      counts: "–",
      measures: "–",
      metricLabel,
      metric: "–",
      coordinate: null,
      emptyMessage: `No drill ${terms.lowercaseSingular} selected`,
    };
  }

  const transition = getTransitionPresentation(previousPage, page);
  return {
    term: terms.singular,
    set: formatSetName(page),
    counts: String(page.countsFromPrevious),
    measures: formatMeasureRange(page.measureRange),
    metricLabel,
    metric:
      metricMode === "step-size"
        ? transition.stepSize
        : transition.crossingCounts,
    coordinate: formatDrillCoordinateLines(page.position, fieldPreset),
  };
}

export function formatMeasureRange(range: DrillSet["measureRange"]): string {
  if (!range) return "–";
  return range.start === range.end
    ? String(range.start)
    : `${range.start}–${range.end}`;
}
