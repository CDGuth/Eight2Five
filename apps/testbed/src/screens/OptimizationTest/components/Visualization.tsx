import React, { useState } from "react";
import { View, Text, TouchableOpacity, LayoutChangeEvent } from "react-native";
import { AnchorGeometry } from "@eight2five/shared/localization/types";
import { RunResult } from "../types";
import { styles, ACCENT_COLOR } from "../styles";
import { DraggableMarker } from "./DraggableMarker";
import { HeatmapOverlay } from "./HeatmapOverlay";
import { InputRow } from "./InputRow";

export const Visualization = ({
  width,
  length,
  result,
  currentAnchors,
  currentTruePos,
  currentInitialFireflies,
  onUpdateTruePos,
  onUpdateAnchor,
  isRandomTruePos,
  onDragStart,
  onDragEnd,
  isRunning,
  showHeatmap,
  onToggleHeatmap,
  isSetup,
  hideControls = false,
  useWhiteBackground = false,
  heatmapResolution = "50",
  onResolutionChange,
}: {
  width: number;
  length: number;
  result: RunResult | null;
  currentAnchors: AnchorGeometry[];
  currentTruePos: { x: number; y: number };
  currentInitialFireflies?: { x: number; y: number }[];
  onUpdateTruePos: (x: number, y: number) => void;
  onUpdateAnchor: (index: number, x: number, y: number) => void;
  isRandomTruePos: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  isRunning: boolean;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  isSetup: boolean;
  hideControls?: boolean;
  useWhiteBackground?: boolean;
  heatmapResolution?: string;
  onResolutionChange?: (res: string) => void;
}) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [showPopulation, setShowPopulation] = useState(true);

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout(e.nativeEvent.layout);
  };

  const scale = layout.width > 0 ? layout.width / width : 0;
  const viewHeight = length * scale;

  // Use result data if available, otherwise fallback to current config
  const anchors = result?.anchors || currentAnchors;
  const truePos = result?.truePos || currentTruePos;
  const estPos = result?.estPos;
  const initialPopulation =
    result?.initialPopulation || currentInitialFireflies;
  const finalPopulation = result?.finalPopulation;

  return (
    <View style={useWhiteBackground && { backgroundColor: "#fff" }}>
      {isSetup && !hideControls && (
        <Text
          style={{
            fontSize: 12,
            color: "#666",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Drag the markers to configure the field.
        </Text>
      )}
      {!hideControls && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            minHeight: 20,
            zIndex: 100,
          }}
        >
          {!isSetup && !isRunning && (
            <>
              {result && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={onToggleHeatmap}
                    style={{
                      marginRight: 15,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={{
                        color: ACCENT_COLOR,
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowPopulation(!showPopulation)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={{
                    color: ACCENT_COLOR,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {showPopulation ? "Hide Population" : "Show Population"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      <View
        style={[
          styles.field,
          { height: viewHeight || 200, marginVertical: 15 },
          useWhiteBackground && { backgroundColor: "#fff" },
        ]}
        onLayout={onLayout}
      >
        {/* Grid Lines (5m intervals) */}
        {scale > 0 &&
          Array.from({ length: Math.floor(width / 5) + 1 }).map((_, i) => (
            <View
              key={`v-${i}`}
              style={{
                position: "absolute",
                left: i * 5 * scale,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(0,0,0,0.1)",
                zIndex: 1,
              }}
            />
          ))}
        {scale > 0 &&
          Array.from({ length: Math.floor(length / 5) + 1 }).map((_, i) => (
            <View
              key={`h-${i}`}
              style={{
                position: "absolute",
                top: i * 5 * scale,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(0,0,0,0.1)",
                zIndex: 1,
              }}
            />
          ))}

        {/* Heatmap */}
        {showHeatmap && result && scale > 0 && (
          <HeatmapOverlay
            width={width}
            length={length}
            scale={scale}
            result={result}
            resolution={Math.max(10, parseInt(heatmapResolution) || 50)}
          />
        )}

        {/* Initial Population */}
        {showPopulation &&
          initialPopulation?.map((p, i) => (
            <View
              key={`init-${i}`}
              style={{
                position: "absolute",
                left: p.x * scale - 2,
                top: p.y * scale - 2,
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(100, 100, 100, 0.3)",
                zIndex: 5,
              }}
            />
          ))}

        {/* Anchors */}
        {anchors.map((a, i) => (
          <DraggableMarker
            key={`anchor-${i}`}
            x={a.x}
            y={a.y}
            scale={scale}
            width={width}
            length={length}
            color="#333"
            onDrag={(x, y) => onUpdateAnchor(i, x, y)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isEditable={!isRunning && !result} // Only editable if not viewing a result
            style={{ zIndex: 10 }}
          />
        ))}

        {/* True Position */}
        {(!isRandomTruePos || result) && (
          <DraggableMarker
            x={truePos.x}
            y={truePos.y}
            scale={scale}
            width={width}
            length={length}
            color="#2e7d32"
            size={16}
            onDrag={onUpdateTruePos}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isEditable={!isRunning && !result && !isRandomTruePos}
            style={{
              borderColor: "#fff",
              borderWidth: 2,
              zIndex: 20,
            }}
          />
        )}

        {/* Estimated Position */}
        {estPos && (
          <View
            style={{
              position: "absolute",
              left: estPos.x * scale - 8,
              top: estPos.y * scale - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#d32f2f",
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 30,
            }}
          />
        )}

        {/* Final Population */}
        {showPopulation &&
          finalPopulation?.map((p, i) => (
            <View
              key={`final-${i}`}
              style={{
                position: "absolute",
                left: p.x * scale - 3,
                top: p.y * scale - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(255, 165, 0, 0.6)", // Orange
                zIndex: 40,
              }}
            />
          ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendMarkerBase, { backgroundColor: "#333" }]}
          />
          <Text style={styles.legendText}>Anchor</Text>
        </View>
        {(!isRandomTruePos || result) && (
          <View style={styles.legendItem}>
            <View
              style={[styles.legendMarkerBase, { backgroundColor: "#2e7d32" }]}
            />
            <Text style={styles.legendText}>True Position</Text>
          </View>
        )}
        {result && (
          <>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendMarkerBase,
                  { backgroundColor: "#d32f2f" },
                ]}
              />
              <Text style={styles.legendText}>Estimated Position</Text>
            </View>
            {showPopulation && (
              <>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendMarkerBase,
                      {
                        backgroundColor: "rgba(100, 100, 100, 0.3)",
                        borderWidth: 0,
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>Initial Population</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendMarkerBase,
                      {
                        backgroundColor: "rgba(255, 165, 0, 0.6)",
                        borderWidth: 0,
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>Final Population</Text>
                </View>
              </>
            )}
          </>
        )}
        {showHeatmap && result && (
          <View
            style={[
              styles.legendItem,
              { width: "100%", justifyContent: "center", marginTop: 10 },
            ]}
          >
            <Text style={[styles.legendText, { marginRight: 8 }]}>
              Low Error
            </Text>
            <View
              style={{
                flexDirection: "row",
                height: 12,
                width: 120,
                borderRadius: 6,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#ddd",
              }}
            >
              <View style={{ flex: 1, backgroundColor: "rgb(128, 0, 128)" }} />
              <View style={{ flex: 1, backgroundColor: "rgb(160, 64, 96)" }} />
              <View style={{ flex: 1, backgroundColor: "rgb(192, 128, 64)" }} />
              <View style={{ flex: 1, backgroundColor: "rgb(224, 192, 32)" }} />
              <View style={{ flex: 1, backgroundColor: "rgb(255, 255, 0)" }} />
            </View>
            <Text style={[styles.legendText, { marginLeft: 8 }]}>
              High Error
            </Text>
          </View>
        )}
        {showHeatmap && result && onResolutionChange && (
          <View style={{ width: "100%", marginTop: 10, paddingHorizontal: 20 }}>
            <InputRow
              label="Heatmap Resolution"
              value={heatmapResolution}
              onChange={(val) => {
                const n = parseInt(val);
                if (val === "") {
                  onResolutionChange("");
                } else if (!isNaN(n)) {
                  // Enforce max 100 for performance. Min 10 handled at use-time.
                  onResolutionChange(Math.min(100, n).toString());
                }
              }}
              tooltip="The number of sample points per axis (e.g. 50x50). Higher values provide more detail but take longer to compute and render. Range: 10-100."
            />
          </View>
        )}
      </View>
    </View>
  );
};
