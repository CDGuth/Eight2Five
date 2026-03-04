import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SweepStepResult } from "../types";
import { ACCENT_COLOR, styles } from "../styles";

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
    return [...results].sort((a, b) => a.val - b.val);
  }, [results]);

  if (data.length < 1) return null;

  const minX = Math.min(...data.map((d) => d.val));
  const maxX = Math.max(...data.map((d) => d.val));
  const minY = 0;
  const maxY =
    Math.max(...data.map((d) => d.avgError + (d.stdDev || 0))) * 1.1 || 1;

  const graphHeight = 200;
  const graphWidth = width > 60 ? width - 60 : 0;

  const getX = (x: number) =>
    maxX === minX ? 0 : ((x - minX) / (maxX - minX)) * graphWidth;
  const getY = (y: number) =>
    graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;

  return (
    <View
      style={{ marginTop: 10, marginBottom: 30, paddingLeft: 40 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Text
        style={[
          styles.resultText,
          { fontWeight: "bold", marginBottom: 15, textAlign: "center" },
        ]}
      >
        Error (m) vs {paramName}
      </Text>
      <View
        style={{
          height: graphHeight,
          width: graphWidth,
          borderLeftWidth: 1,
          borderBottomWidth: 1,
          borderColor: "#ccc",
        }}
      >
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <View
            key={`grid-y-${t}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: getY(t * maxY),
              height: 1,
              backgroundColor: "#eee",
              zIndex: -1,
            }}
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <View
            key={`grid-x-${t}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: getX(minX + t * (maxX - minX)),
              width: 1,
              backgroundColor: "#eee",
              zIndex: -1,
            }}
          />
        ))}

        {/* Y-axis labels */}
        <Text
          style={{
            position: "absolute",
            left: -35,
            top: 0,
            fontSize: 10,
            color: "#666",
          }}
        >
          {maxY.toFixed(1)}
        </Text>
        <Text
          style={{
            position: "absolute",
            left: -35,
            bottom: 0,
            fontSize: 10,
            color: "#666",
          }}
        >
          0
        </Text>

        {/* X-axis labels */}
        <Text
          style={{
            position: "absolute",
            left: 0,
            bottom: -20,
            fontSize: 10,
            color: "#666",
          }}
        >
          {minX.toFixed(1)}
        </Text>
        <Text
          style={{
            position: "absolute",
            right: 0,
            bottom: -20,
            fontSize: 10,
            color: "#666",
          }}
        >
          {maxX.toFixed(1)}
        </Text>

        {/* Data Line */}
        {data.length > 1 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {data.map((d, i) => {
              if (i === 0) return null;
              const prev = data[i - 1];
              const x1 = getX(prev.val);
              const y1 = getY(prev.avgError);
              const x2 = getX(d.val);
              const y2 = getY(d.avgError);
              const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              const angle = Math.atan2(y2 - y1, x2 - x1);

              return (
                <View
                  key={`line-${i}`}
                  style={{
                    position: "absolute",
                    left: x1,
                    top: y1,
                    width: length,
                    height: 2,
                    backgroundColor: ACCENT_COLOR,
                    transform: [
                      { translateX: 0 },
                      { translateY: 0 },
                      { rotate: `${angle}rad` },
                    ],
                    transformOrigin: "left center",
                  }}
                />
              );
            })}
          </View>
        )}

        {/* Data Points & Error Bars */}
        {data.map((d, i) => {
          const x = getX(d.val);
          const y = getY(d.avgError);
          const isSelected = selectedIndex === i;

          return (
            <React.Fragment key={`point-group-${i}`}>
              {/* Error Bar */}
              {d.stdDev > 0 && (
                <View
                  style={{
                    position: "absolute",
                    left: x,
                    top: getY(d.avgError + d.stdDev),
                    width: 1,
                    height:
                      getY(d.avgError - d.stdDev) - getY(d.avgError + d.stdDev),
                    backgroundColor: "#999",
                    zIndex: 1,
                  }}
                >
                  {/* Caps */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: -3,
                      width: 7,
                      height: 1,
                      backgroundColor: "#999",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: -3,
                      width: 7,
                      height: 1,
                      backgroundColor: "#999",
                    }}
                  />
                </View>
              )}

              {/* Point */}
              <TouchableOpacity
                onPress={() => onSelectPoint?.(i)}
                style={{
                  position: "absolute",
                  left: x - 5,
                  top: y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isSelected ? "#FF5722" : ACCENT_COLOR,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: "#fff",
                  zIndex: 5,
                }}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              />
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};
