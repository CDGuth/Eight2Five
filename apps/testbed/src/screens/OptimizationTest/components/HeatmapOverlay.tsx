import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { RunResult } from "../types";
import { TwoRayGroundModel } from "@eight2five/shared/localization/models/TwoRayGroundModel";
import { LogNormalModel } from "@eight2five/shared/localization/models/LogNormalModel";
import { DEFAULT_TX_POWER_DBM } from "@eight2five/shared/localization/LocalizationConfig";

export const HeatmapOverlay = ({
  width,
  length,
  scale,
  result,
  resolution = 50,
}: {
  width: number;
  length: number;
  scale: number;
  result: RunResult;
  resolution?: number;
}) => {
  const stepX = width / resolution;
  const stepY = length / resolution;

  const heatmapData = useMemo(() => {
    if (!result) return null;

    const data = [];
    let minError = Infinity;
    let maxError = -Infinity;

    // Reconstruct model
    let model;
    if (result.modelType === "TwoRayGround") {
      model = new TwoRayGroundModel();
    } else {
      model = new LogNormalModel();
    }

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = (i + 0.5) * stepX;
        const y = (j + 0.5) * stepY;

        let errorSum = 0;
        let count = 0;

        for (const m of result.measurements) {
          const anchor = result.anchors.find((a) => a.mac === m.mac);
          if (anchor) {
            const dist = Math.sqrt((x - anchor.x) ** 2 + (y - anchor.y) ** 2);
            const predictedRssi = model.estimateRssi({
              distanceMeters: dist,
              txPowerDbm: m.txPower || DEFAULT_TX_POWER_DBM,
              constants: result.constants,
            });
            errorSum += (predictedRssi - m.filteredRssi) ** 2;
            count++;
          }
        }

        const rmse = count > 0 ? Math.sqrt(errorSum / count) : 0;
        minError = Math.min(minError, rmse);
        maxError = Math.max(maxError, rmse);

        data.push({ x, y, error: rmse });
      }
    }

    return { data, minError, maxError };
  }, [result, stepX, stepY, resolution]);

  if (!heatmapData) return null;

  const { data, minError, maxError } = heatmapData;
  const range = maxError - minError || 1;

  const getColor = (error: number) => {
    // Normalize 0-1
    const t = (error - minError) / range;
    // Purple (low error) to Yellow (high error)
    // Purple: rgb(128, 0, 128) -> Yellow: rgb(255, 255, 0)
    const r = Math.floor(128 + t * (255 - 128));
    const g = Math.floor(0 + t * 255);
    const b = Math.floor(128 + t * (0 - 128));
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {data.map((cell, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: (cell.x - stepX / 2) * scale,
            top: (cell.y - stepY / 2) * scale,
            width: stepX * scale,
            height: stepY * scale,
            backgroundColor: getColor(cell.error),
          }}
        />
      ))}
    </View>
  );
};
