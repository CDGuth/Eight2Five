import type { StyleProp, ViewStyle } from "react-native";
import type { PansPosition } from "expo-pans-ble-api";
import type { SharedValue } from "react-native-reanimated";

import type {
  GridBounds,
  GridPoint,
  GridSize,
  GridViewport,
} from "./pans-network-grid-math";
import type { MapAreaMode, MapUnits } from "./map-units";

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
  distanceMeters?: number;
  quality?: number;
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
  units?: MapUnits;
  areaMode?: MapAreaMode;
  areaBounds?: readonly GridBounds[];
  editMode?: boolean;
  onLongPressCoordinate?(point: GridPoint): void;
  /** Legacy fixed-height compatibility. Omit to fill the available flex space. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
