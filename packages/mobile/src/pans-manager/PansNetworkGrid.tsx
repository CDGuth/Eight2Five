import React from "react";
import {
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Canvas, Circle, Fill, Group, Path } from "@shopify/react-native-skia";
import type { PansPosition } from "expo-pans-ble-api";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  buildConsolidatedGridPath,
  chooseGridInterval,
  DEFAULT_GRID_VIEWPORT,
  normalizeGridViewport,
  type GridPoint,
  type GridSize,
  type GridViewport,
} from "./pans-network-grid-math";

export type PansGridNodeStatus = "normal" | "warning" | "error" | "offline";

export interface PansGridPalette {
  background: string;
  grid: string;
  anchor: string;
  tag: string;
  initiator: string;
  selected: string;
  offline: string;
  warning: string;
  error: string;
  label: string;
  edge: string;
}

export interface PansGridCameraSharedValues {
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  metersPerPixel: SharedValue<number>;
}

export interface PansGridNode {
  id: string;
  /** Optional hardware node ID metadata used to resolve actual ranging frames. */
  nodeIdHex?: string;
  label?: string;
  role: "anchor" | "tag";
  position: Pick<PansPosition, "xMeters" | "yMeters">;
  livePosition?: SharedValue<GridPoint>;
  initiator?: boolean;
  panMismatch?: boolean;
  status?: PansGridNodeStatus;
}

export interface PansGridObservedEdge {
  sourceId: string;
  targetId: string;
}

export interface PansNetworkGridProps {
  nodes: PansGridNode[];
  palette: PansGridPalette;
  observedEdges?: PansGridObservedEdge[];
  viewport?: GridViewport;
  defaultViewport?: GridViewport;
  camera?: PansGridCameraSharedValues;
  onViewportChange?(viewport: GridViewport): void;
  onSizeChange?(size: GridSize): void;
  selectedNodeId?: string;
  onSelectNode?(nodeId: string | undefined): void;
  showLabels?: boolean;
  labelFontFamily?: string;
  showGrid?: boolean;
  gridIntervalMeters?: number;
  showOrigin?: boolean;
  editMode?: boolean;
  onLongPressCoordinate?(point: GridPoint): void;
  /** Legacy fixed-height compatibility. Omit to fill the available flex space. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

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
  const canvasSize = useSharedValue<GridSize>({ width: 0, height: 0 });
  const gestureActive = useSharedValue(false);
  const camera = externalCamera ?? {
    centerX: internalCenterX,
    centerY: internalCenterY,
    metersPerPixel: internalMetersPerPixel,
  };

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
    const next = normalizedControlledViewport;
    camera.centerX.value = next.centerXMeters;
    camera.centerY.value = next.centerYMeters;
    camera.metersPerPixel.value = next.metersPerPixel;
  }, [
    camera.centerX,
    camera.centerY,
    camera.metersPerPixel,
    normalizedControlledViewport,
  ]);

  const commitViewport = React.useCallback(
    (centerXMeters: number, centerYMeters: number, metersPerPixel: number) => {
      const next = normalizeGridViewport({
        centerXMeters,
        centerYMeters,
        metersPerPixel,
      });
      if (!normalizedControlledViewport) setInternalCommittedViewport(next);
      onViewportChange?.(next);
    },
    [normalizedControlledViewport, onViewportChange],
  );

  const panStartX = useSharedValue(initialViewport.centerXMeters);
  const panStartY = useSharedValue(initialViewport.centerYMeters);
  const panStartScale = useSharedValue(initialViewport.metersPerPixel);
  const pinchStartScale = useSharedValue(initialViewport.metersPerPixel);
  const pinchWorldX = useSharedValue(0);
  const pinchWorldY = useSharedValue(0);

  const pan = Gesture.Pan()
    .withTestId(`${testID}-pan-gesture`)
    .maxPointers(1)
    .minDistance(2)
    .onStart(() => {
      gestureActive.value = true;
      panStartX.value = camera.centerX.value;
      panStartY.value = camera.centerY.value;
      panStartScale.value = camera.metersPerPixel.value;
    })
    .onUpdate((event) => {
      camera.centerX.value =
        panStartX.value - event.translationX * panStartScale.value;
      camera.centerY.value =
        panStartY.value + event.translationY * panStartScale.value;
    })
    .onEnd(() => {
      runOnJS(commitViewport)(
        camera.centerX.value,
        camera.centerY.value,
        camera.metersPerPixel.value,
      );
    })
    .onFinalize(() => {
      gestureActive.value = false;
    });

  const pinch = Gesture.Pinch()
    .withTestId(`${testID}-pinch-gesture`)
    .onStart((event) => {
      gestureActive.value = true;
      pinchStartScale.value = camera.metersPerPixel.value;
      pinchWorldX.value =
        camera.centerX.value +
        (event.focalX - canvasSize.value.width / 2) *
          camera.metersPerPixel.value;
      pinchWorldY.value =
        camera.centerY.value -
        (event.focalY - canvasSize.value.height / 2) *
          camera.metersPerPixel.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(
        10_000,
        Math.max(
          0.0001,
          pinchStartScale.value / Math.max(event.scale, 0.000001),
        ),
      );
      camera.metersPerPixel.value = nextScale;
      camera.centerX.value =
        pinchWorldX.value -
        (event.focalX - canvasSize.value.width / 2) * nextScale;
      camera.centerY.value =
        pinchWorldY.value +
        (event.focalY - canvasSize.value.height / 2) * nextScale;
    })
    .onEnd(() => {
      runOnJS(commitViewport)(
        camera.centerX.value,
        camera.centerY.value,
        camera.metersPerPixel.value,
      );
    })
    .onFinalize(() => {
      gestureActive.value = false;
    });

  const selectOnJS = React.useCallback(
    (nodeId: string | undefined) => onSelectNode?.(nodeId),
    [onSelectNode],
  );
  const hitTargets = React.useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        xMeters: node.position.xMeters,
        yMeters: node.position.yMeters,
        livePosition: node.livePosition,
      })),
    [nodes],
  );
  const tap = Gesture.Tap()
    .withTestId(`${testID}-tap-gesture`)
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (!success) return;
      let selected: string | undefined;
      let closestDistance = 24;
      for (const target of hitTargets) {
        const position = target.livePosition?.value ?? target;
        const x =
          canvasSize.value.width / 2 +
          (position.xMeters - camera.centerX.value) /
            camera.metersPerPixel.value;
        const y =
          canvasSize.value.height / 2 -
          (position.yMeters - camera.centerY.value) /
            camera.metersPerPixel.value;
        const distance = Math.hypot(x - event.x, y - event.y);
        if (distance <= closestDistance) {
          closestDistance = distance;
          selected = target.id;
        }
      }
      runOnJS(selectOnJS)(selected);
    });

  const longPressOnJS = React.useCallback(
    (point: GridPoint) => onLongPressCoordinate?.(point),
    [onLongPressCoordinate],
  );
  const longPress = Gesture.LongPress()
    .withTestId(`${testID}-long-press-gesture`)
    .enabled(editMode && Boolean(onLongPressCoordinate))
    .minDuration(550)
    .maxDistance(12)
    .onStart((event) => {
      const point = {
        xMeters:
          camera.centerX.value +
          (event.x - canvasSize.value.width / 2) * camera.metersPerPixel.value,
        yMeters:
          camera.centerY.value -
          (event.y - canvasSize.value.height / 2) * camera.metersPerPixel.value,
      };
      runOnJS(longPressOnJS)(point);
    });
  const gesture = Gesture.Race(
    Gesture.Simultaneous(pan, pinch),
    Gesture.Exclusive(longPress, tap),
  );

  const cameraTransform = useDerivedValue(() => [
    { translateX: canvasSize.value.width / 2 },
    { translateY: canvasSize.value.height / 2 },
    { scaleX: 1 / camera.metersPerPixel.value },
    { scaleY: -1 / camera.metersPerPixel.value },
    { translateX: -camera.centerX.value },
    { translateY: -camera.centerY.value },
  ]);
  const gridStrokeWidth = useDerivedValue(() => camera.metersPerPixel.value);
  const edgeStrokeWidth = useDerivedValue(
    () => camera.metersPerPixel.value * 2,
  );
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
        showOrigin,
      }),
    [committedViewport, interval, showGrid, showOrigin, size],
  );
  const edgeTargets = React.useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return observedEdges
      .map((edge) => ({
        source: byId.get(edge.sourceId),
        target: byId.get(edge.targetId),
      }))
      .filter((edge): edge is { source: PansGridNode; target: PansGridNode } =>
        Boolean(edge.source && edge.target),
      );
  }, [nodes, observedEdges]);
  const edgePath = useDerivedValue(() => {
    return edgeTargets
      .map((edge) => {
        const source = edge.source.livePosition?.value ?? edge.source.position;
        const target = edge.target.livePosition?.value ?? edge.target.position;
        return `M ${source.xMeters} ${source.yMeters} L ${target.xMeters} ${target.yMeters}`;
      })
      .join(" ");
  });

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
        style={[
          height === undefined ? { flex: 1 } : { height },
          { overflow: "hidden", backgroundColor: palette.background },
          style,
        ]}
        onLayout={onLayout}
      >
        <Canvas
          style={{ flex: 1 }}
          onSize={canvasSize}
          testID={`${testID}-canvas`}
        >
          <Fill color={palette.background} />
          <Group transform={cameraTransform}>
            {gridPath ? (
              <Path
                path={gridPath}
                color={palette.grid}
                style="stroke"
                strokeWidth={gridStrokeWidth}
              />
            ) : null}
            {edgeTargets.length ? (
              <Path
                path={edgePath}
                color={palette.edge}
                style="stroke"
                strokeWidth={edgeStrokeWidth}
              />
            ) : null}
            {nodes.map((node) => (
              <GridNodeSymbol
                key={node.id}
                node={node}
                cameraScale={camera.metersPerPixel}
                palette={palette}
                selected={selectedNodeId === node.id}
              />
            ))}
          </Group>
        </Canvas>
        {showLabels
          ? nodes.map((node) => (
              <GridNodeLabel
                key={`label-${node.id}`}
                node={node}
                camera={camera}
                canvasSize={canvasSize}
                gestureActive={gestureActive}
                color={palette.label}
                fontFamily={labelFontFamily}
              />
            ))
          : null}
      </View>
    </GestureDetector>
  );
}

const GridNodeSymbol = React.memo(function GridNodeSymbol({
  node,
  cameraScale,
  palette,
  selected,
}: {
  node: PansGridNode;
  cameraScale: SharedValue<number>;
  palette: PansGridPalette;
  selected: boolean;
}) {
  const transform = useDerivedValue(() => {
    const position = node.livePosition?.value ?? node.position;
    return [
      { translateX: position.xMeters },
      { translateY: position.yMeters },
      { scaleX: cameraScale.value },
      { scaleY: -cameraScale.value },
    ];
  });
  const color = nodeColor(node, palette);

  return (
    <Group transform={transform}>
      {node.role === "anchor" ? (
        <Path
          path="M 0 -10 L -10 9 L 10 9 Z"
          color={color}
          style="stroke"
          strokeWidth={3}
        />
      ) : (
        <Circle cx={0} cy={0} r={8} color={color} />
      )}
      {node.initiator ? (
        <Circle cx={0} cy={2} r={3} color={palette.initiator} />
      ) : null}
      {node.panMismatch ? (
        <Circle
          cx={0}
          cy={0}
          r={node.role === "anchor" ? 13 : 11}
          color={palette.warning}
          style="stroke"
          strokeWidth={2}
        />
      ) : null}
      {selected ? (
        <Circle
          cx={0}
          cy={0}
          r={node.role === "anchor" ? 16 : 14}
          color={palette.selected}
          style="stroke"
          strokeWidth={2}
        />
      ) : null}
    </Group>
  );
});

const GridNodeLabel = React.memo(function GridNodeLabel({
  node,
  camera,
  canvasSize,
  gestureActive,
  color,
  fontFamily,
}: {
  node: PansGridNode;
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  gestureActive: SharedValue<boolean>;
  color: string;
  fontFamily: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const position = node.livePosition?.value ?? node.position;
    return {
      opacity: gestureActive.value ? 0 : 1,
      transform: [
        {
          translateX:
            canvasSize.value.width / 2 +
            (position.xMeters - camera.centerX.value) /
              camera.metersPerPixel.value +
            12,
        },
        {
          translateY:
            canvasSize.value.height / 2 -
            (position.yMeters - camera.centerY.value) /
              camera.metersPerPixel.value -
            10,
        },
      ],
    };
  });
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          color,
          fontSize: 12,
          fontFamily,
        },
        animatedStyle,
      ]}
    >
      {node.label ?? node.id}
    </Animated.Text>
  );
});

function nodeColor(node: PansGridNode, palette: PansGridPalette): string {
  if (node.status === "error") return palette.error;
  if (node.status === "warning") return palette.warning;
  if (node.status === "offline") return palette.offline;
  return node.role === "anchor" ? palette.anchor : palette.tag;
}
