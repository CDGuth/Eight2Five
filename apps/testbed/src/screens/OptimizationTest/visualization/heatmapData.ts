import { DEFAULT_TX_POWER_DBM } from "@eight2five/mobile/localization/LocalizationConfig";
import { LogNormalModel } from "@eight2five/mobile/localization/models/LogNormalModel";
import { TwoRayGroundModel } from "@eight2five/mobile/localization/models/TwoRayGroundModel";

import { RunResult } from "../types";

/**
 * Legend gradient swatch colors for the heatmap legend (low → high error).
 * These are data-visualization colors, not theme tokens, so they are kept as
 * literal RGB values and shared between the overlay and its legend.
 */
export const HEATMAP_GRADIENT_STOPS = [
  "rgb(128, 0, 128)",
  "rgb(160, 64, 96)",
  "rgb(192, 128, 64)",
  "rgb(224, 192, 32)",
  "rgb(255, 255, 0)",
] as const;

export interface HeatmapCell {
  x: number;
  y: number;
  error: number;
  color: string;
}

export interface HeatmapData {
  cells: HeatmapCell[];
  minError: number;
  maxError: number;
  stepX: number;
  stepY: number;
}

interface CreateHeatmapDataParams {
  width: number;
  length: number;
  result: RunResult;
  resolution: number;
}

function getHeatmapColor(error: number, minError: number, maxError: number) {
  const range = maxError - minError || 1;
  const t = (error - minError) / range;
  const r = Math.floor(128 + t * (255 - 128));
  const g = Math.floor(t * 255);
  const b = Math.floor(128 + t * (0 - 128));
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
}

export function createHeatmapData({
  width,
  length,
  result,
  resolution,
}: CreateHeatmapDataParams): HeatmapData {
  const boundedResolution = Math.max(1, Math.floor(resolution));
  const stepX = width / boundedResolution;
  const stepY = length / boundedResolution;
  const model =
    result.modelType === "TwoRayGround"
      ? new TwoRayGroundModel()
      : new LogNormalModel();
  const anchorsByMac = new Map(
    result.anchors.map((anchor) => [anchor.mac, anchor] as const),
  );
  const measurementAnchors = result.measurements.flatMap((measurement) => {
    const anchor = anchorsByMac.get(measurement.mac);
    return anchor ? [{ measurement, anchor }] : [];
  });
  const cellsWithoutColor: Omit<HeatmapCell, "color">[] = [];
  let minError = Infinity;
  let maxError = -Infinity;

  for (let i = 0; i < boundedResolution; i++) {
    for (let j = 0; j < boundedResolution; j++) {
      const x = (i + 0.5) * stepX;
      const y = (j + 0.5) * stepY;
      let errorSum = 0;

      for (const { measurement, anchor } of measurementAnchors) {
        const dist = Math.sqrt((x - anchor.x) ** 2 + (y - anchor.y) ** 2);
        const predictedRssi = model.estimateRssi({
          distanceMeters: dist,
          txPowerDbm: measurement.txPower || DEFAULT_TX_POWER_DBM,
          constants: result.constants,
        });
        errorSum += (predictedRssi - measurement.filteredRssi) ** 2;
      }

      const rmse =
        measurementAnchors.length > 0
          ? Math.sqrt(errorSum / measurementAnchors.length)
          : 0;
      minError = Math.min(minError, rmse);
      maxError = Math.max(maxError, rmse);
      cellsWithoutColor.push({ x, y, error: rmse });
    }
  }

  if (!Number.isFinite(minError) || !Number.isFinite(maxError)) {
    minError = 0;
    maxError = 0;
  }

  return {
    cells: cellsWithoutColor.map((cell) => ({
      ...cell,
      color: getHeatmapColor(cell.error, minError, maxError),
    })),
    minError,
    maxError,
    stepX,
    stepY,
  };
}
