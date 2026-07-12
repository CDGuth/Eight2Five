import React from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Circle, Line, Rect, vec } from "@shopify/react-native-skia";
import type { PansPosition } from "expo-pans-ble-api";
import {
  chooseGridInterval,
  DEFAULT_GRID_VIEWPORT,
  panGridViewport,
  screenToWorld,
  worldToScreen,
  zoomGridViewport,
  type GridPoint,
  type GridSize,
  type GridViewport,
} from "./pans-network-grid-math";

export type PansGridNodeStatus = "normal" | "warning" | "error" | "offline";

export interface PansGridNode {
  id: string;
  label?: string;
  role: "anchor" | "tag";
  position: Pick<PansPosition, "xMeters" | "yMeters">;
  initiator?: boolean;
  status?: PansGridNodeStatus;
}

export interface PansGridObservedEdge {
  sourceId: string;
  targetId: string;
}

export interface PansNetworkGridProps {
  nodes: PansGridNode[];
  observedEdges?: PansGridObservedEdge[];
  viewport?: GridViewport;
  defaultViewport?: GridViewport;
  onViewportChange?(viewport: GridViewport): void;
  selectedNodeId?: string;
  onSelectNode?(nodeId: string | undefined): void;
  showLabels?: boolean;
  editMode?: boolean;
  onLongPressCoordinate?(point: GridPoint): void;
  height?: number;
  testID?: string;
}

export function PansNetworkGrid({
  nodes,
  observedEdges = [],
  viewport: controlledViewport,
  defaultViewport = DEFAULT_GRID_VIEWPORT,
  onViewportChange,
  selectedNodeId,
  onSelectNode,
  showLabels = true,
  editMode = false,
  onLongPressCoordinate,
  height = 420,
  testID = "pans-network-grid",
}: PansNetworkGridProps) {
  const [size, setSize] = React.useState<GridSize>({ width: 0, height });
  const [internalViewport, setInternalViewport] =
    React.useState(defaultViewport);
  const viewport = controlledViewport ?? internalViewport;

  const updateViewport = React.useCallback(
    (next: GridViewport) => {
      const clamped = {
        ...next,
        metersPerPixel: Math.min(10_000, Math.max(0.0001, next.metersPerPixel)),
      };
      if (!controlledViewport) setInternalViewport(clamped);
      onViewportChange?.(clamped);
    },
    [controlledViewport, onViewportChange],
  );

  const responder = React.useMemo(
    () =>
      createGridPanResponder({
        viewport,
        size,
        nodes,
        editMode,
        onLongPressCoordinate,
        onSelectNode,
        updateViewport,
      }),
    [
      editMode,
      nodes,
      onLongPressCoordinate,
      onSelectNode,
      size,
      updateViewport,
      viewport,
    ],
  );

  const drawing = React.useMemo(() => {
    if (!size.width) return { vertical: [], horizontal: [], screenNodes: [] };
    const interval = chooseGridInterval(viewport.metersPerPixel);
    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport, size);
    const bottomRight = screenToWorld(
      { x: size.width, y: size.height },
      viewport,
      size,
    );
    const vertical: number[] = [];
    for (
      let x = Math.floor(topLeft.xMeters / interval) * interval;
      x <= bottomRight.xMeters;
      x += interval
    )
      vertical.push(
        worldToScreen({ xMeters: x, yMeters: 0 }, viewport, size).x,
      );
    const horizontal: number[] = [];
    for (
      let y = Math.floor(bottomRight.yMeters / interval) * interval;
      y <= topLeft.yMeters;
      y += interval
    )
      horizontal.push(
        worldToScreen({ xMeters: 0, yMeters: y }, viewport, size).y,
      );
    return {
      vertical,
      horizontal,
      screenNodes: nodes.map((node) => ({
        ...node,
        screen: worldToScreen(node.position, viewport, size),
      })),
    };
  }, [nodes, size, viewport]);
  const screenNodeById = new Map(
    drawing.screenNodes.map((node) => [node.id, node]),
  );

  const onLayout = (event: LayoutChangeEvent) =>
    setSize({ width: event.nativeEvent.layout.width, height });

  return (
    <View
      testID={testID}
      style={{ height, overflow: "hidden", backgroundColor: "#f8fafc" }}
      onLayout={onLayout}
      {...responder.panHandlers}
    >
      <Canvas style={{ width: size.width, height }} testID={`${testID}-canvas`}>
        <Rect x={0} y={0} width={size.width} height={height} color="#f8fafc" />
        {drawing.vertical.map((x) => (
          <Line
            key={`x-${x}`}
            p1={vec(x, 0)}
            p2={vec(x, height)}
            color="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {drawing.horizontal.map((y) => (
          <Line
            key={`y-${y}`}
            p1={vec(0, y)}
            p2={vec(size.width, y)}
            color="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {observedEdges.map((edge) => {
          const source = screenNodeById.get(edge.sourceId)?.screen;
          const target = screenNodeById.get(edge.targetId)?.screen;
          return source && target ? (
            <Line
              key={`${edge.sourceId}-${edge.targetId}`}
              p1={vec(source.x, source.y)}
              p2={vec(target.x, target.y)}
              color="#94a3b8"
              strokeWidth={2}
            />
          ) : null;
        })}
        {drawing.screenNodes.map((node) => {
          const { x, y } = node.screen;
          const color = statusColor(node.status);
          return node.role === "anchor" ? (
            <React.Fragment key={node.id}>
              <Line
                p1={vec(x, y - 10)}
                p2={vec(x - 10, y + 9)}
                color={color}
                strokeWidth={3}
              />
              <Line
                p1={vec(x - 10, y + 9)}
                p2={vec(x + 10, y + 9)}
                color={color}
                strokeWidth={3}
              />
              <Line
                p1={vec(x + 10, y + 9)}
                p2={vec(x, y - 10)}
                color={color}
                strokeWidth={3}
              />
              {node.initiator ? (
                <Circle cx={x} cy={y + 2} r={3} color="#7c3aed" />
              ) : null}
              {selectedNodeId === node.id ? (
                <Circle
                  cx={x}
                  cy={y}
                  r={16}
                  color="#2563eb"
                  style="stroke"
                  strokeWidth={2}
                />
              ) : null}
            </React.Fragment>
          ) : (
            <React.Fragment key={node.id}>
              <Circle cx={x} cy={y} r={8} color={color} />
              {selectedNodeId === node.id ? (
                <Circle
                  cx={x}
                  cy={y}
                  r={14}
                  color="#2563eb"
                  style="stroke"
                  strokeWidth={2}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Canvas>
      {showLabels
        ? drawing.screenNodes.map((node) => (
            <Text
              key={`label-${node.id}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: node.screen.x + 12,
                top: node.screen.y - 10,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              {node.label ?? node.id}
            </Text>
          ))
        : null}
    </View>
  );
}

function statusColor(status: PansGridNodeStatus | undefined): string {
  if (status === "error") return "#dc2626";
  if (status === "warning") return "#d97706";
  if (status === "offline") return "#94a3b8";
  return "#2563eb";
}

function createGridPanResponder(options: {
  viewport: GridViewport;
  size: GridSize;
  nodes: PansGridNode[];
  editMode: boolean;
  onLongPressCoordinate?: (point: GridPoint) => void;
  onSelectNode?: (nodeId: string | undefined) => void;
  updateViewport(viewport: GridViewport): void;
}) {
  let moved = false;
  let startedAt = 0;
  let pinchDistance = 0;
  let gestureViewport = options.viewport;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelLongPress = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = undefined;
  };
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY, touches } = event.nativeEvent;
      moved = false;
      startedAt = Date.now();
      gestureViewport = options.viewport;
      pinchDistance = touches.length >= 2 ? touchDistance(touches) : 0;
      if (options.editMode && options.onLongPressCoordinate) {
        longPressTimer = setTimeout(() => {
          options.onLongPressCoordinate?.(
            screenToWorld(
              { x: locationX, y: locationY },
              options.viewport,
              options.size,
            ),
          );
        }, 550);
      }
    },
    onPanResponderMove: (event, state) => {
      const touches = event.nativeEvent.touches;
      if (Math.hypot(state.dx, state.dy) > 6) {
        moved = true;
        cancelLongPress();
      }
      if (touches.length >= 2 && pinchDistance > 0) {
        const ratio = touchDistance(touches) / pinchDistance;
        options.updateViewport(
          zoomGridViewport(
            gestureViewport,
            options.size,
            touchFocalPoint(touches, options.size),
            ratio,
          ),
        );
      } else {
        options.updateViewport(
          panGridViewport(gestureViewport, { x: state.dx, y: state.dy }),
        );
      }
    },
    onPanResponderRelease: (event) => {
      cancelLongPress();
      if (!moved && Date.now() - startedAt < 550) {
        const point = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
        };
        const selected = options.nodes
          .map((node) => ({
            id: node.id,
            point: worldToScreen(node.position, options.viewport, options.size),
          }))
          .find(
            (node) =>
              Math.hypot(node.point.x - point.x, node.point.y - point.y) <= 24,
          );
        options.onSelectNode?.(selected?.id);
      }
    },
    onPanResponderTerminate: cancelLongPress,
  });
}

function touchDistance(touches: readonly GridTouch[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[0].pageX - touches[1].pageX,
    touches[0].pageY - touches[1].pageY,
  );
}

interface GridTouch {
  pageX: number;
  pageY: number;
  locationX?: number;
  locationY?: number;
}

function touchFocalPoint(
  touches: readonly GridTouch[],
  size: GridSize,
): { x: number; y: number } {
  if (touches.length < 2) return { x: size.width / 2, y: size.height / 2 };
  const firstX = touches[0].locationX;
  const firstY = touches[0].locationY;
  const secondX = touches[1].locationX;
  const secondY = touches[1].locationY;
  if (
    firstX === undefined ||
    firstY === undefined ||
    secondX === undefined ||
    secondY === undefined
  ) {
    return { x: size.width / 2, y: size.height / 2 };
  }
  return { x: (firstX + secondX) / 2, y: (firstY + secondY) / 2 };
}
