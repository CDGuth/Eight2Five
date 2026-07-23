import React from "react";
import { Canvas, Fill, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { GridNodeSymbol } from "./PansNetworkGridNode";
import type { GridSize } from "./pans-network-grid-math";
import type {
  PansGridCameraSharedValues,
  PansGridNode,
  PansGridObservedEdge,
  PansGridPalette,
} from "./pans-network-grid-types";

interface PansNetworkGridCanvasProps {
  camera: PansGridCameraSharedValues;
  canvasSize: SharedValue<GridSize>;
  nodes: PansGridNode[];
  observedEdges: PansGridObservedEdge[];
  palette: PansGridPalette;
  selectedNodeId?: string;
  gridPath: string;
  originPath: string;
  boundsPath: string;
  testID: string;
}

export function PansNetworkGridCanvas({
  camera,
  canvasSize,
  nodes,
  observedEdges,
  palette,
  selectedNodeId,
  gridPath,
  originPath,
  boundsPath,
  testID,
}: PansNetworkGridCanvasProps) {
  const cameraTransform = useDerivedValue(() => [
    { translateX: canvasSize.value.width / 2 },
    { translateY: canvasSize.value.height / 2 },
    { scaleX: 1 / camera.metersPerPixel.value },
    { scaleY: -1 / camera.metersPerPixel.value },
    { translateX: -camera.centerX.value },
    { translateY: -camera.centerY.value },
  ]);
  const gridStrokeWidth = useDerivedValue(() => camera.metersPerPixel.value);
  const emphasizedStrokeWidth = useDerivedValue(
    () => camera.metersPerPixel.value * 2,
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
  const edgePath = useDerivedValue(() =>
    edgeTargets
      .map((edge) => {
        const source = edge.source.livePosition?.value ?? edge.source.position;
        const target = edge.target.livePosition?.value ?? edge.target.position;
        return `M ${source.xMeters} ${source.yMeters} L ${target.xMeters} ${target.yMeters}`;
      })
      .join(" "),
  );

  return (
    <Canvas style={{ flex: 1 }} onSize={canvasSize} testID={`${testID}-canvas`}>
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
        {originPath ? (
          <Path
            path={originPath}
            color={palette.label}
            style="stroke"
            strokeWidth={emphasizedStrokeWidth}
          />
        ) : null}
        {boundsPath ? (
          <Path
            path={boundsPath}
            color={palette.warning}
            style="stroke"
            strokeWidth={emphasizedStrokeWidth}
          />
        ) : null}
        {edgeTargets.length ? (
          <Path
            path={edgePath}
            color={palette.edge}
            style="stroke"
            strokeWidth={emphasizedStrokeWidth}
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
  );
}
