import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, Rect } from "@shopify/react-native-skia";

import { RunResult } from "../types";
import { createHeatmapData } from "../visualization/heatmapData";
export { HEATMAP_GRADIENT_STOPS } from "../visualization/heatmapData";

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
  const heatmapData = useMemo(() => {
    if (!result) return null;
    return createHeatmapData({ width, length, result, resolution });
  }, [width, length, result, resolution]);

  if (!heatmapData) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {heatmapData.cells.map((cell, i) => (
          <Rect
            key={i}
            x={(cell.x - heatmapData.stepX / 2) * scale}
            y={(cell.y - heatmapData.stepY / 2) * scale}
            width={heatmapData.stepX * scale}
            height={heatmapData.stepY * scale}
            color={cell.color}
          />
        ))}
      </Canvas>
    </View>
  );
};
