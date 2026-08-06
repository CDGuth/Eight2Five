import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import type {
  CountDisplayMode,
  DrillSetHudPresentation,
} from "../field-hud-state";

export interface AnimatedMetricPresentation {
  readonly key: string;
  readonly direction: -1 | 1;
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
        direction: -1,
        label: "Counts",
        value: presentation.counts,
      }
    : {
        key: mode,
        direction: 1,
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
    direction: mode === "step-size" ? -1 : 1,
    label: presentation.metricLabel,
    value: presentation.metric,
  };
}
