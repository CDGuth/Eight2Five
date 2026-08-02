import {
  drillGridPointToMarchingCoordinate,
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  type FieldLivePositionState,
} from "@eight2five/mobile/field";
import { formatSetName, type DrillSet } from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";

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
  readonly term: "Set";
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
): CoordinateLines {
  const coordinate = drillGridPointToMarchingCoordinate(position);
  return {
    side: formatMarchingSide(coordinate.side),
    frontBack: formatMarchingFrontBack(coordinate.frontBack),
  };
}

export function getLiveCoordinatePresentation(
  live: FieldLivePositionState,
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
  const coordinate = fieldPointToMarchingCoordinate(live.position);
  return {
    ...(live.isStale ? { statusLabel: "Last known position" } : {}),
    primary: formatMarchingSide(coordinate.side),
    secondary: formatMarchingFrontBack(coordinate.frontBack),
    muted: live.isStale,
  };
}

export function getDrillCoordinatePresentation({
  page,
  previousPage,
  metricMode,
}: {
  readonly page?: DrillSet;
  readonly previousPage?: DrillSet;
  readonly metricMode: TransitionMetricMode;
  /** @deprecated Sets are the only v2 terminology. */
  readonly terminology?: unknown;
}): DrillCoordinatePresentation {
  const metricLabel = metricMode === "step-size" ? "Step Size" : "xCounts";
  if (!page) {
    return {
      term: "Set",
      set: "–",
      counts: "–",
      measures: "–",
      metricLabel,
      metric: "–",
      coordinate: null,
      emptyMessage: "No drill set selected",
    };
  }
  const transition = getTransitionPresentation(previousPage, page);
  return {
    term: "Set",
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
    coordinate: formatDrillCoordinateLines(page.position),
  };
}
