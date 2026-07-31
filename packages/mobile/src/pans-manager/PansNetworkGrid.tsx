import React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";

import { PansNetworkGridCanvas } from "./PansNetworkGridCanvas";
import { PansNetworkGridOverlays } from "./PansNetworkGridOverlays";
import { setGridCamera } from "./pans-network-grid-camera";
import {
  buildConsolidatedBoundsPath,
  buildConsolidatedGridPath,
  chooseGridInterval,
  DEFAULT_GRID_VIEWPORT,
  normalizeGridViewport,
  unionGridBounds,
  type GridSize,
} from "./pans-network-grid-math";
import type { PansNetworkGridProps } from "./pans-network-grid-types";
import { usePansNetworkGridGestures } from "./use-pans-network-grid-gestures";

export type {
  PansGridCameraSharedValues,
  PansGridNode,
  PansGridNodeStatus,
  PansGridObservedEdge,
  PansGridPalette,
  PansNetworkGridProps,
} from "./pans-network-grid-types";

export function PansNetworkGrid({
  nodes,
  palette,
  observedEdges = [],
  viewport: controlledViewport,
  defaultViewport = DEFAULT_GRID_VIEWPORT,
  camera: externalCamera,
  onViewportChange,
  onSizeChange,
  selectedNodeId,
  onSelectNode,
  showLabels = true,
  labelFontFamily = "SourceSans3_400Regular",
  showGrid = true,
  gridIntervalMeters,
  showOrigin = false,
  units = "metric",
  areaMode = "infinite",
  areaBounds = [],
  editMode = false,
  onLongPressCoordinate,
  height,
  style,
  testID = "pans-network-grid",
}: PansNetworkGridProps) {
  const [initialViewport] = React.useState(() =>
    normalizeGridViewport(controlledViewport ?? defaultViewport),
  );
  const [size, setSize] = React.useState<GridSize>({
    width: 0,
    height: height ?? 0,
  });
  const layoutSizeRef = React.useRef<GridSize>({
    width: 0,
    height: height ?? 0,
  });
  const [internalCommittedViewport, setInternalCommittedViewport] =
    React.useState(initialViewport);
  const internalCenterX = useSharedValue(initialViewport.centerXMeters);
  const internalCenterY = useSharedValue(initialViewport.centerYMeters);
  const internalMetersPerPixel = useSharedValue(initialViewport.metersPerPixel);
  const internalCamera = React.useMemo(
    () => ({
      centerX: internalCenterX,
      centerY: internalCenterY,
      metersPerPixel: internalMetersPerPixel,
    }),
    [internalCenterX, internalCenterY, internalMetersPerPixel],
  );
  const camera = externalCamera ?? internalCamera;
  const canvasSize = useSharedValue<GridSize>({ width: 0, height: 0 });

  const boundedArea = React.useMemo(
    () => (areaMode === "bounded" ? unionGridBounds(areaBounds) : undefined),
    [areaBounds, areaMode],
  );
  const controlledCenterX = controlledViewport?.centerXMeters;
  const controlledCenterY = controlledViewport?.centerYMeters;
  const controlledScale = controlledViewport?.metersPerPixel;
  const normalizedControlledViewport = React.useMemo(
    () =>
      controlledCenterX === undefined ||
      controlledCenterY === undefined ||
      controlledScale === undefined
        ? undefined
        : normalizeGridViewport({
            centerXMeters: controlledCenterX,
            centerYMeters: controlledCenterY,
            metersPerPixel: controlledScale,
          }),
    [controlledCenterX, controlledCenterY, controlledScale],
  );
  const committedViewport =
    normalizedControlledViewport ?? internalCommittedViewport;

  React.useEffect(() => {
    if (!normalizedControlledViewport) return;
    setGridCamera(camera, normalizedControlledViewport);
  }, [camera, normalizedControlledViewport]);

  const commitViewport = React.useCallback(
    (nextViewport: typeof initialViewport) => {
      const next = normalizeGridViewport(nextViewport);
      if (!normalizedControlledViewport) setInternalCommittedViewport(next);
      onViewportChange?.(next);
    },
    [normalizedControlledViewport, onViewportChange],
  );
  const { gesture, gestureActive } = usePansNetworkGridGestures({
    camera,
    canvasSize,
    nodes,
    boundedMinX: boundedArea?.minXMeters,
    boundedMaxX: boundedArea?.maxXMeters,
    boundedMinY: boundedArea?.minYMeters,
    boundedMaxY: boundedArea?.maxYMeters,
    editMode,
    onViewportChange: commitViewport,
    onSelectNode,
    onLongPressCoordinate,
    testID,
  });

  const interval =
    gridIntervalMeters &&
    Number.isFinite(gridIntervalMeters) &&
    gridIntervalMeters > 0
      ? gridIntervalMeters
      : chooseGridInterval(committedViewport.metersPerPixel);
  const gridPath = React.useMemo(
    () =>
      buildConsolidatedGridPath(committedViewport, size, interval, {
        showGrid,
        showOrigin: false,
      }),
    [committedViewport, interval, showGrid, size],
  );
  const originPath = React.useMemo(
    () =>
      buildConsolidatedGridPath(committedViewport, size, interval, {
        showGrid: false,
        showOrigin,
      }),
    [committedViewport, interval, showOrigin, size],
  );
  const boundsPath = React.useMemo(
    () => buildConsolidatedBoundsPath(areaBounds),
    [areaBounds],
  );

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const next = {
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      };
      if (
        layoutSizeRef.current.width === next.width &&
        layoutSizeRef.current.height === next.height
      )
        return;
      layoutSizeRef.current = next;
      setSize(next);
      onSizeChange?.(next);
    },
    [onSizeChange],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel="PANS network map"
        accessibilityHint="Shows anchors, tags, network bounds, and ranging relationships. Map settings provide non-gesture controls."
        accessibilityValue={{
          text: `${nodes.length} node${nodes.length === 1 ? "" : "s"}${
            selectedNodeId
              ? `; selected ${
                  nodes.find((node) => node.id === selectedNodeId)?.label ??
                  selectedNodeId
                }`
              : ""
          }`,
        }}
        style={[
          height === undefined ? { flex: 1 } : { height },
          { overflow: "hidden", backgroundColor: palette.background },
          style,
        ]}
        onLayout={onLayout}
      >
        <PansNetworkGridCanvas
          camera={camera}
          canvasSize={canvasSize}
          nodes={nodes}
          observedEdges={observedEdges}
          palette={palette}
          selectedNodeId={selectedNodeId}
          gridPath={gridPath}
          originPath={originPath}
          boundsPath={boundsPath}
          testID={testID}
        />
        <PansNetworkGridOverlays
          nodes={nodes}
          observedEdges={observedEdges}
          camera={camera}
          canvasSize={canvasSize}
          gestureActive={gestureActive}
          committedViewport={committedViewport}
          size={size}
          intervalMeters={interval}
          showLabels={showLabels}
          showOrigin={showOrigin}
          units={units}
          color={palette.label}
          backgroundColor={palette.background}
          fontFamily={labelFontFamily}
          testID={testID}
        />
      </View>
    </GestureDetector>
  );
}
