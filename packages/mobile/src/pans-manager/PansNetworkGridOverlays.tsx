import React from "react";
import { Text as NativeText } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { formatMapCoordinate, formatMapDistance } from "./map-units";
import type { MapUnits } from "./map-units";
import type {
  GridPoint,
  GridSize,
  GridViewport,
} from "./pans-network-grid-math";
import type {
  PansGridCameraSharedValues,
  PansGridNode,
  PansGridObservedEdge,
} from "./pans-network-grid-types";

interface PansNetworkGridOverlaysProps {
  nodes: PansGridNode[];
  observedEdges?: PansGridObservedEdge[];
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  gestureActive: SharedValue<boolean>;
  committedViewport: GridViewport;
  size: GridSize;
  intervalMeters: number;
  showLabels: boolean;
  showOrigin: boolean;
  units: MapUnits;
  color: string;
  backgroundColor: string;
  fontFamily: string;
  testID: string;
}

export function PansNetworkGridOverlays({
  nodes,
  observedEdges = [],
  camera,
  canvasSize,
  gestureActive,
  committedViewport,
  size,
  intervalMeters,
  showLabels,
  showOrigin,
  units,
  color,
  backgroundColor,
  fontFamily,
  testID,
}: PansNetworkGridOverlaysProps) {
  const axisTickLabels = React.useMemo(
    () =>
      showOrigin
        ? buildAxisTickLabels(committedViewport, size, intervalMeters, units)
        : [],
    [committedViewport, intervalMeters, showOrigin, size, units],
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

  return (
    <>
      {showLabels
        ? nodes.map((node) => (
            <GridNodeLabel
              key={`label-${node.id}`}
              node={node}
              camera={camera}
              canvasSize={canvasSize}
              gestureActive={gestureActive}
              color={color}
              fontFamily={fontFamily}
            />
          ))
        : null}
      {showLabels
        ? edgeTargets.map(({ source, target }) => (
            <GridEdgeLabel
              key={`edge-${source.id}-${target.id}`}
              source={source}
              target={target}
              camera={camera}
              canvasSize={canvasSize}
              gestureActive={gestureActive}
              color={color}
              fontFamily={fontFamily}
            />
          ))
        : null}
      {axisTickLabels.map((tick) => (
        <GridAxisTickLabel
          key={tick.key}
          point={tick.point}
          label={tick.label}
          axis={tick.axis}
          camera={camera}
          canvasSize={canvasSize}
          gestureActive={gestureActive}
          color={color}
          fontFamily={fontFamily}
        />
      ))}
      <NativeText
        testID={`${testID}-scale-indicator`}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          color,
          fontFamily,
          fontSize: 12,
          backgroundColor,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        {formatMapDistance(intervalMeters, units)} grid
      </NativeText>
    </>
  );
}

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
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
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

const GridEdgeLabel = React.memo(function GridEdgeLabel({
  source,
  target,
  camera,
  canvasSize,
  gestureActive,
  color,
  fontFamily,
}: {
  source: PansGridNode;
  target: PansGridNode;
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  gestureActive: SharedValue<boolean>;
  color: string;
  fontFamily: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const sourcePos = source.livePosition?.value ?? source.position;
    const targetPos = target.livePosition?.value ?? target.position;
    const midX = (sourcePos.xMeters + targetPos.xMeters) / 2;
    const midY = (sourcePos.yMeters + targetPos.yMeters) / 2;
    return {
      opacity: gestureActive.value ? 0 : 1,
      transform: [
        {
          translateX:
            canvasSize.value.width / 2 +
            (midX - camera.centerX.value) / camera.metersPerPixel.value +
            6,
        },
        {
          translateY:
            canvasSize.value.height / 2 -
            (midY - camera.centerY.value) / camera.metersPerPixel.value -
            15,
        },
      ],
    };
  });

  return (
    <Animated.Text
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          color,
          fontSize: 10,
          fontFamily,
        },
        animatedStyle,
      ]}
    >
      {target.label ?? target.id.slice(0, 6)}
    </Animated.Text>
  );
});

interface GridAxisTick {
  key: string;
  point: GridPoint;
  label: string;
  axis: "x" | "y";
}

function buildAxisTickLabels(
  viewport: GridViewport,
  size: GridSize,
  intervalMeters: number,
  units: MapUnits,
): GridAxisTick[] {
  if (
    size.width <= 0 ||
    size.height <= 0 ||
    !Number.isFinite(intervalMeters) ||
    intervalMeters <= 0
  )
    return [];
  const halfWidth = (size.width * viewport.metersPerPixel) / 2;
  const halfHeight = (size.height * viewport.metersPerPixel) / 2;
  const minX = viewport.centerXMeters - halfWidth;
  const maxX = viewport.centerXMeters + halfWidth;
  const minY = viewport.centerYMeters - halfHeight;
  const maxY = viewport.centerYMeters + halfHeight;
  const ticks: GridAxisTick[] = [];
  const maximumTicks = 80;

  if (minY <= 0 && maxY >= 0) {
    for (
      let x = Math.ceil(minX / intervalMeters) * intervalMeters;
      x <= maxX && ticks.length < maximumTicks;
      x += intervalMeters
    ) {
      ticks.push({
        key: `x:${x}`,
        point: { xMeters: x, yMeters: 0 },
        label: formatMapCoordinate(x, units, 3),
        axis: "x",
      });
    }
  }
  if (minX <= 0 && maxX >= 0) {
    for (
      let y = Math.ceil(minY / intervalMeters) * intervalMeters;
      y <= maxY && ticks.length < maximumTicks;
      y += intervalMeters
    ) {
      if (Math.abs(y) < intervalMeters * 1e-9) continue;
      ticks.push({
        key: `y:${y}`,
        point: { xMeters: 0, yMeters: y },
        label: formatMapCoordinate(y, units, 3),
        axis: "y",
      });
    }
  }
  return ticks;
}

const GridAxisTickLabel = React.memo(function GridAxisTickLabel({
  point,
  label,
  axis,
  camera,
  canvasSize,
  gestureActive,
  color,
  fontFamily,
}: {
  point: GridPoint;
  label: string;
  axis: "x" | "y";
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  gestureActive: SharedValue<boolean>;
  color: string;
  fontFamily: string;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: gestureActive.value ? 0 : 0.75,
    transform: [
      {
        translateX:
          canvasSize.value.width / 2 +
          (point.xMeters - camera.centerX.value) / camera.metersPerPixel.value +
          (axis === "y" ? 5 : -8),
      },
      {
        translateY:
          canvasSize.value.height / 2 -
          (point.yMeters - camera.centerY.value) / camera.metersPerPixel.value +
          (axis === "x" ? 5 : -8),
      },
    ],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          color,
          fontSize: 10,
          fontFamily,
        },
        animatedStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
});
