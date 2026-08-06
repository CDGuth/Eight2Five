import type { FieldPresetId } from "@eight2five/drill-schema";
import type { CoordinateRoundingSteps } from "@eight2five/mobile/settings";
import {
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  metersToStandardSteps,
  type FieldLivePositionState,
  type FieldPoint,
} from "@eight2five/mobile/field";

import type { CoordinateLines } from "./field-hud-state";

export function getLiveCoordinateLines(
  live: FieldLivePositionState,
  fieldPreset: FieldPresetId = "football-nfhs",
  roundingSteps: CoordinateRoundingSteps = 0.25,
): CoordinateLines | null {
  if (!live.position || live.isStale) return null;
  const coordinate = fieldPointToMarchingCoordinate(live.position, fieldPreset);
  return {
    side: formatMarchingSide(coordinate.side, roundingSteps),
    frontBack: formatMarchingFrontBack(
      coordinate.frontBack,
      fieldPreset,
      roundingSteps,
    ),
  };
}

export type DistanceTone = "success" | "warning" | "danger" | "muted";

export interface TargetDistancePresentation {
  readonly steps?: number;
  readonly value: string;
  readonly tone: DistanceTone;
}

export function getTargetDistancePresentation({
  live,
  target,
  greenThresholdSteps,
  yellowThresholdSteps,
}: {
  readonly live: FieldLivePositionState;
  readonly target?: FieldPoint;
  readonly greenThresholdSteps: number;
  readonly yellowThresholdSteps: number;
}): TargetDistancePresentation {
  if (!live.position || live.isStale || !target) {
    return { value: "–", tone: "muted" };
  }

  const distanceMeters = Math.hypot(
    live.position.xMeters - target.xMeters,
    live.position.yMeters - target.yMeters,
  );
  const steps = metersToStandardSteps(distanceMeters);
  const roundedSteps = Number(steps.toFixed(1));
  return {
    steps,
    value: roundedSteps === 1 ? "one step" : `${roundedSteps.toFixed(1)} steps`,
    tone:
      steps <= greenThresholdSteps
        ? "success"
        : steps <= yellowThresholdSteps
          ? "warning"
          : "danger",
  };
}
