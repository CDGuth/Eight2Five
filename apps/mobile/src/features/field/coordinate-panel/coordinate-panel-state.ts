import {
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  type FieldLivePositionState,
} from "@eight2five/mobile/field";
import {
  getDrillTerms,
  type DrillPage,
  type DrillTerminology,
} from "@eight2five/mobile/drill";
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
  readonly term: "Page" | "Set";
  readonly page: string;
  readonly counts: string;
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

export function formatCoordinateLines(
  position: DrillPage["position"],
): CoordinateLines {
  const coordinate = fieldPointToMarchingCoordinate(position);
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
  const coordinate = formatCoordinateLines(live.position);
  return {
    ...(live.isStale ? { statusLabel: "Last known position" } : {}),
    primary: coordinate.side,
    secondary: coordinate.frontBack,
    muted: live.isStale,
  };
}

export function getDrillCoordinatePresentation({
  page,
  previousPage,
  terminology,
  metricMode,
}: {
  readonly page?: DrillPage;
  readonly previousPage?: DrillPage;
  readonly terminology: DrillTerminology;
  readonly metricMode: TransitionMetricMode;
}): DrillCoordinatePresentation {
  const term = getDrillTerms(terminology).singular;
  const metricLabel = metricMode === "step-size" ? "Step Size" : "xCounts";
  if (!page) {
    return {
      term,
      page: "–",
      counts: "–",
      metricLabel,
      metric: "–",
      coordinate: null,
      emptyMessage: "No drill page selected",
    };
  }
  const transition = getTransitionPresentation(previousPage, page);
  return {
    term,
    page: page.label || String(page.ordinal + 1),
    counts: previousPage ? String(page.countsFromPrevious) : "–",
    metricLabel,
    metric:
      metricMode === "step-size"
        ? transition.stepSize
        : transition.crossingCounts,
    coordinate: formatCoordinateLines(page.position),
  };
}
