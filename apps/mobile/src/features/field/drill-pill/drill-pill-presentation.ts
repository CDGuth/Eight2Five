import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import type {
  CountDisplayMode,
  DrillSetHudPresentation,
} from "../field-hud-state";

export interface AnimatedMetricPresentation {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export function getCountMetricPresentation(
  presentation: DrillSetHudPresentation,
  mode: CountDisplayMode,
): AnimatedMetricPresentation {
  return mode === "counts"
    ? {
        key: mode,
        label: "Counts",
        value: presentation.counts,
      }
    : {
        key: mode,
        label: "Measures",
        value: presentation.measures,
      };
}

export function getTransitionMetricPresentation(
  presentation: DrillSetHudPresentation,
  mode: TransitionMetricMode,
): AnimatedMetricPresentation {
  return {
    key: mode,
    label: presentation.metricLabel,
    value: presentation.metric,
  };
}
