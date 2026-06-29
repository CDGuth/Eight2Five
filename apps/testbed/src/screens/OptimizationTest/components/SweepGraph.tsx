import React, { useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { Box } from "@eight2five/ui/box";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";

import { SweepStepResult } from "../types";

const CHART_HEIGHT = 200;
const CHART_LEFT_PADDING = 40;
const CHART_RIGHT_PADDING = 20;

// Data-visualization colors are kept as literals because Victory Native and
// Skia draw outside the gluestack className styling pipeline.
const SERIES_COLOR = "#2563eb";
const SELECTED_POINT_COLOR = "#f97316";
const GRID_COLOR = "#e5e7eb";
const ERROR_BAR_COLOR = "#71717a";

export const SweepGraph = ({
  results,
  paramName,
  onSelectPoint,
  selectedIndex,
}: {
  results: SweepStepResult[];
  paramName: string;
  onSelectPoint?: (index: number) => void;
  selectedIndex?: number | null;
}) => {
  const [width, setWidth] = useState(0);
  const data = useMemo(() => {
    return results
      .map((result, originalIndex) => ({ ...result, originalIndex }))
      .sort((a, b) => a.val - b.val);
  }, [results]);

  if (data.length < 1) return null;

  const minX = Math.min(...data.map((d) => d.val));
  const maxX = Math.max(...data.map((d) => d.val));
  const xDomain: [number, number] =
    maxX === minX ? [minX - 1, maxX + 1] : [minX, maxX];
  const minY = 0;
  const maxY =
    Math.max(...data.map((d) => d.avgError + (d.stdDev || 0))) * 1.1 || 1;
  const graphWidth = Math.max(
    width - CHART_LEFT_PADDING - CHART_RIGHT_PADDING,
    0,
  );
  const hasLayout = graphWidth > 0;

  const getX = (x: number) =>
    maxX === minX ? graphWidth / 2 : ((x - minX) / (maxX - minX)) * graphWidth;
  const getY = (y: number) =>
    CHART_HEIGHT - ((y - minY) / (maxY - minY)) * CHART_HEIGHT;
  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <Box className="mb-8 mt-2.5" onLayout={handleLayout}>
      <Text
        size="xs"
        bold
        className="mb-4 text-center font-mono text-foreground"
      >
        Error (m) vs {paramName}
      </Text>
      <Box
        className="relative border-b border-l border-border"
        style={{
          height: CHART_HEIGHT,
          width: graphWidth,
          marginLeft: CHART_LEFT_PADDING,
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <Box
            key={`grid-y-${t}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: getY(t * maxY),
              height: 1,
              backgroundColor: GRID_COLOR,
              zIndex: -1,
            }}
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <Box
            key={`grid-x-${t}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: getX(minX + t * (maxX - minX)),
              width: 1,
              backgroundColor: GRID_COLOR,
              zIndex: -1,
            }}
          />
        ))}

        <Text
          size="xs"
          className="absolute -left-9 top-0 text-muted-foreground"
        >
          {maxY.toFixed(1)}
        </Text>
        <Text
          size="xs"
          className="absolute -bottom-1 -left-9 text-muted-foreground"
        >
          0
        </Text>
        <Text
          size="xs"
          className="absolute -bottom-5 left-0 text-muted-foreground"
        >
          {minX.toFixed(1)}
        </Text>
        <Text
          size="xs"
          className="absolute -bottom-5 right-0 text-muted-foreground"
        >
          {maxX.toFixed(1)}
        </Text>

        {hasLayout && (
          <Box style={{ height: CHART_HEIGHT, width: graphWidth }}>
            <CartesianChart
              data={data}
              xKey="val"
              yKeys={["avgError"]}
              domain={{ x: xDomain, y: [minY, maxY] }}
            >
              {({ points }) => (
                <Line
                  points={points.avgError}
                  color={SERIES_COLOR}
                  strokeWidth={2}
                />
              )}
            </CartesianChart>
          </Box>
        )}

        {data.map((d) => {
          const x = getX(d.val);
          const y = getY(d.avgError);
          const isSelected = selectedIndex === d.originalIndex;

          return (
            <React.Fragment key={`point-group-${d.originalIndex}`}>
              {d.stdDev > 0 && (
                <Box
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: x,
                    top: getY(d.avgError + d.stdDev),
                    width: 1,
                    height:
                      getY(d.avgError - d.stdDev) - getY(d.avgError + d.stdDev),
                    backgroundColor: ERROR_BAR_COLOR,
                    zIndex: 1,
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      top: 0,
                      left: -3,
                      width: 7,
                      height: 1,
                      backgroundColor: ERROR_BAR_COLOR,
                    }}
                  />
                  <Box
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: -3,
                      width: 7,
                      height: 1,
                      backgroundColor: ERROR_BAR_COLOR,
                    }}
                  />
                </Box>
              )}

              <Pressable
                accessibilityLabel={`Sweep point ${d.originalIndex + 1}`}
                onPress={() => onSelectPoint?.(d.originalIndex)}
                style={{
                  position: "absolute",
                  left: x - 5,
                  top: y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isSelected
                    ? SELECTED_POINT_COLOR
                    : SERIES_COLOR,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: "#fff",
                  zIndex: 5,
                }}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              />
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
};
