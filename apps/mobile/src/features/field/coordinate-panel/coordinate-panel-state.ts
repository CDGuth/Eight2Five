import {
  drillGridPointToMarchingCoordinate,
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  type FieldLivePositionState,
} from "@eight2five/mobile/field";
import {
  formatSetName,
  getDrillTerms,
  type DrillSet,
  type DrillTerminology,
} from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";
import type { FieldPresetId } from "@eight2five/drill-schema";

import { getTransitionPresentation } from "../../drill/transition-presentation";

export interface CoordinateLines {
  readonly side: string;
  readonly frontBack: string;
}

export interface LiveCoordinatePresentation {
  readonly statusLabel?: string;
  readonly primary: string;
  readonly secondary: string;
  readonly muted: boolean;
}

export interface DrillCoordinatePresentation {
  readonly term: "Page" | "Set";
  readonly set: string;
  readonly counts: string;
  readonly measures: string;
  readonly metricLabel: "Step Size" | "xCounts";
  readonly metric: string;
  readonly coordinate: CoordinateLines | null;
  readonly emptyMessage?: string;
}

export function areCoordinatePanelControlsDisabled({
  settingsReady,
  loadingDrills,
  selectionBusy,
}: {
  readonly settingsReady: boolean;
  readonly loadingDrills: boolean;
  readonly selectionBusy: boolean;
}): boolean {
  return !settingsReady || loadingDrills || selectionBusy;
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

export function getLiveCoordinatePresentation(
  live: FieldLivePositionState,
  fieldPreset: FieldPresetId = "football-nfhs",
): LiveCoordinatePresentation {
  if (!live.position) {
    return {
      primary: "Waiting for live position",
      secondary:
        live.connectionState === "error" && live.errorMessage
          ? live.errorMessage
          : "Connect a PANS tag to begin",
      muted: true,
    };
  }
  const coordinate = fieldPointToMarchingCoordinate(live.position, fieldPreset);
  return {
    ...(live.isStale ? { statusLabel: "Last known position" } : {}),
    primary: formatMarchingSide(coordinate.side),
    secondary: formatMarchingFrontBack(coordinate.frontBack, fieldPreset),
    muted: live.isStale,
  };
}

export function getDrillCoordinatePresentation({
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
}): DrillCoordinatePresentation {
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
    measures: page.measureRange
      ? page.measureRange.start === page.measureRange.end
        ? String(page.measureRange.start)
        : `${page.measureRange.start}–${page.measureRange.end}`
      : "–",
    metricLabel,
    metric:
      metricMode === "step-size"
        ? transition.stepSize
        : transition.crossingCounts,
    coordinate: formatDrillCoordinateLines(page.position, fieldPreset),
  };
}
