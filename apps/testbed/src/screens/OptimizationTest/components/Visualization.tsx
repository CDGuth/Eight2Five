import React, { useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import { AnchorGeometry } from "@eight2five/mobile/localization/types";
import { Box } from "@eight2five/ui/box";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";
import { RunResult } from "../types";
import { DraggableMarker } from "./DraggableMarker";
import { HeatmapOverlay, HEATMAP_GRADIENT_STOPS } from "./HeatmapOverlay";
import { InputRow } from "./InputRow";

const ANCHOR_COLOR = "#333";
const TRUE_POSITION_COLOR = "#2e7d32";
const ESTIMATED_POSITION_COLOR = "#d32f2f";

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
    <Box style={useWhiteBackground && { backgroundColor: "#fff" }}>
      {isSetup && !hideControls && (
        <Text size="xs" className="mb-2 text-center text-muted-foreground">
          Drag the markers to configure the field.
        </Text>
      )}
      {!hideControls && (
        <Box className="z-[100] flex min-h-[20px] flex-row items-center justify-end">
          {!isSetup && !isRunning && (
            <>
              {result && (
                <Box className="flex-row items-center">
                  <Pressable
                    onPress={onToggleHeatmap}
                    accessibilityLabel="Toggle heatmap"
                    className="mr-[15px] px-3 py-2"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text size="xs" className="font-semibold text-primary">
                      {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                    </Text>
                  </Pressable>
                </Box>
              )}
              <Pressable
                onPress={() => setShowPopulation(!showPopulation)}
                accessibilityLabel="Toggle population"
                className="px-3 py-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text size="xs" className="font-semibold text-primary">
                  {showPopulation ? "Hide Population" : "Show Population"}
                </Text>
              </Pressable>
            </>
          )}
        </Box>
      )}
      <Box
        className="relative rounded-lg bg-muted"
        style={[
          { height: viewHeight || 200, marginVertical: 15 },
          useWhiteBackground && { backgroundColor: "#fff" },
        ]}
        onLayout={onLayout}
      >
        {/* Drawing code — intentionally uses RN primitives */}
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
        {/* Drawing code — intentionally uses RN primitives */}
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

        {/* Drawing code — intentionally uses RN primitives */}
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

        {/* Drawing code — intentionally uses RN primitives */}
        {/* Anchors */}
        {anchors.map((a, i) => (
          <DraggableMarker
            key={`anchor-${i}`}
            x={a.x}
            y={a.y}
            scale={scale}
            width={width}
            length={length}
            color={ANCHOR_COLOR}
            onDrag={(x, y) => onUpdateAnchor(i, x, y)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isEditable={!isRunning && !result} // Only editable if not viewing a result
            style={{ zIndex: 10 }}
          />
        ))}

        {/* Drawing code — intentionally uses RN primitives */}
        {/* True Position */}
        {(!isRandomTruePos || result) && (
          <DraggableMarker
            x={truePos.x}
            y={truePos.y}
            scale={scale}
            width={width}
            length={length}
            color={TRUE_POSITION_COLOR}
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

        {/* Drawing code — intentionally uses RN primitives */}
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
              backgroundColor: ESTIMATED_POSITION_COLOR,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 30,
            }}
          />
        )}

        {/* Drawing code — intentionally uses RN primitives */}
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
                backgroundColor: "rgba(255, 165, 0, 0.6)",
                zIndex: 40,
              }}
            />
          ))}
      </Box>

      {/* Legend */}
      <Box className="mt-2.5 flex flex-row flex-wrap justify-center">
        <Box className="mb-2 mr-4 flex flex-row items-center">
          <View className="mr-1.5 h-2.5 w-2.5 rounded-full border border-background bg-testbed-anchor" />
          <Text size="xs" className="text-muted-foreground">
            Anchor
          </Text>
        </Box>
        {(!isRandomTruePos || result) && (
          <Box className="mb-2 mr-4 flex flex-row items-center">
            <View className="mr-1.5 h-2.5 w-2.5 rounded-full border border-background bg-testbed-true-position" />
            <Text size="xs" className="text-muted-foreground">
              True Position
            </Text>
          </Box>
        )}
        {result && (
          <>
            <Box className="mb-2 mr-4 flex flex-row items-center">
              <View className="mr-1.5 h-2.5 w-2.5 rounded-full border border-background bg-testbed-estimated-position" />
              <Text size="xs" className="text-muted-foreground">
                Estimated Position
              </Text>
            </Box>
            {showPopulation && (
              <>
                <Box className="mb-2 mr-4 flex flex-row items-center">
                  <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-testbed-initial-population" />
                  <Text size="xs" className="text-muted-foreground">
                    Initial Population
                  </Text>
                </Box>
                <Box className="mb-2 mr-4 flex flex-row items-center">
                  <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-testbed-final-population" />
                  <Text size="xs" className="text-muted-foreground">
                    Final Population
                  </Text>
                </Box>
              </>
            )}
          </>
        )}
        {showHeatmap && result && (
          <Box className="mt-2.5 flex w-full flex-row items-center justify-center">
            <Text size="xs" className="mr-2 text-muted-foreground">
              Low Error
            </Text>
            <View className="h-3 w-[120px] flex-row overflow-hidden rounded-md border border-border">
              {HEATMAP_GRADIENT_STOPS.map((color, i) => (
                <View
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </View>
            <Text size="xs" className="ml-2 text-muted-foreground">
              High Error
            </Text>
          </Box>
        )}
        {showHeatmap && result && onResolutionChange && (
          <Box className="mt-2.5 w-full px-5">
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
          </Box>
        )}
      </Box>
    </Box>
  );
};
