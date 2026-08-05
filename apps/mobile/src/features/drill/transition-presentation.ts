import {
  analyzeDrillTransition,
  type DrillPage,
  type TransitionAnalysis,
} from "@eight2five/mobile/drill";

export interface TransitionPresentation {
  readonly stepSize: string;
  readonly crossingCounts: string;
}

export function formatTransitionAnalysis(
  analysis: TransitionAnalysis,
  hasPreviousPage: boolean,
  countsFromPrevious: number,
): TransitionPresentation {
  if (!hasPreviousPage || countsFromPrevious === 0) {
    return { stepSize: "–", crossingCounts: "–" };
  }
  return {
    stepSize: analysis.isHalt
      ? "Hold"
      : analysis.stepSizeToFive === undefined
        ? "–"
        : `${formatMetricNumber(analysis.stepSizeToFive)} to 5`,
    crossingCounts:
      analysis.yardLineCrossingCounts.length > 0
        ? analysis.yardLineCrossingCounts.map(formatMetricNumber).join(", ")
        : "–",
  };
}

export function getTransitionPresentation(
  previousPage: DrillPage | undefined,
  page: DrillPage,
): TransitionPresentation {
  return formatTransitionAnalysis(
    analyzeDrillTransition(previousPage, page),
    Boolean(previousPage),
    page.countsFromPrevious,
  );
}

function formatMetricNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
