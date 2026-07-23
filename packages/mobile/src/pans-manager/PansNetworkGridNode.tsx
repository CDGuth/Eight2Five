import React from "react";
import { Circle, Group, Path } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import type { PansGridNode, PansGridPalette } from "./pans-network-grid-types";

export const GridNodeSymbol = React.memo(function GridNodeSymbol({
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

function nodeColor(node: PansGridNode, palette: PansGridPalette): string {
  if (node.status === "error") return palette.error;
  if (node.status === "warning") return palette.warning;
  if (node.status === "offline") return palette.offline;
  return node.role === "anchor" ? palette.anchor : palette.tag;
}
