import React from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Settings2 } from "lucide-react-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import {
  formatMapDistance,
  PansNetworkGrid,
} from "@eight2five/mobile/pans-manager";
import type {
  MapUnits,
  PansGridNode,
  PansGridObservedEdge,
  PansGridPalette,
} from "@eight2five/mobile/pans-manager";
import { Button, ButtonIcon } from "@eight2five/ui/components/button";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { ManagerMapSettingsModal } from "../components/manager-map-settings-modal";
import { usePansMapDataController } from "../manager-map-controller";
import { useTestbedToolbarAction } from "../../components/testbed-toolbar";

export function ManagerMapScreen({
  initialNetworkId,
}: {
  initialNetworkId?: string;
}) {
  const theme = useEight2FiveTheme();
  const controller = usePansMapDataController(initialNetworkId);
  const stopTracking = controller.stopTracking;
  const setTrackingDiagnosticsVisible =
    controller.setTrackingDiagnosticsVisible;
  const selectedNode = controller.selectedNodeId
    ? controller.nodes.find((node) => node.id === controller.selectedNodeId)
    : undefined;
  const selectedDistances = selectedNode
    ? controller.rangingEdges.filter((edge) =>
        [edge.sourceId, edge.targetId].includes(selectedNode.id),
      )
    : [];
  const selectedPositionText = selectedNode
    ? `X ${formatMapDistance(
        selectedNode.position.xMeters,
        controller.mapUnits,
      )} · Y ${formatMapDistance(
        selectedNode.position.yMeters,
        controller.mapUnits,
      )}`
    : undefined;
  const livePosition = selectedNode?.livePosition;

  const [livePositionText, setLivePositionText] = React.useState<string>();

  const updateLivePositionText = React.useCallback(
    (point: { xMeters: number; yMeters: number } | null) => {
      if (!point) {
        setLivePositionText(undefined);
        return;
      }
      setLivePositionText(
        `X ${formatMapDistance(point.xMeters, controller.mapUnits)} · Y ${formatMapDistance(point.yMeters, controller.mapUnits)}`,
      );
    },
    [controller.mapUnits],
  );

  useAnimatedReaction(
    () => {
      if (!livePosition) return null;
      return {
        xMeters: livePosition.value.xMeters,
        yMeters: livePosition.value.yMeters,
      };
    },
    (current) => {
      runOnJS(updateLivePositionText)(current);
    },
  );

  const displayPositionText = livePositionText ?? selectedPositionText;

  const nodeById = React.useMemo(
    () => new Map(controller.nodes.map((node) => [node.id, node])),
    [controller.nodes],
  );

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const palette = React.useMemo<PansGridPalette>(
    () => ({
      background: theme.background,
      grid: theme.border,
      anchor: theme.accent,
      tag: theme.success,
      initiator: theme.warning,
      selected: theme.accentPressed,
      offline: theme.textSubtle,
      warning: theme.warning,
      error: theme.danger,
      label: theme.text,
      edge: theme.textMuted,
    }),
    [theme],
  );
  const settingsAction = React.useMemo(
    () => (
      <Button
        testID="manager-map-settings-button"
        accessibilityLabel="Open map settings"
        variant="link"
        size="lg"
        onPress={() => setSettingsOpen(true)}
        className="h-11 w-11"
      >
        <ButtonIcon as={Settings2} style={{ color: theme.raw.white }} />
      </Button>
    ),
    [setSettingsOpen, theme.raw.white],
  );
  useTestbedToolbarAction("pans-map-settings", settingsAction);

  React.useEffect(() => {
    setTrackingDiagnosticsVisible(settingsOpen);
    return () => setTrackingDiagnosticsVisible(false);
  }, [setTrackingDiagnosticsVisible, settingsOpen]);

  useFocusEffect(
    React.useCallback(
      () => () => {
        void stopTracking();
      },
      [stopTracking],
    ),
  );

  return (
    <View
      testID="manager-map-screen"
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <PansNetworkGrid
        style={{ flex: 1 }}
        nodes={controller.nodes}
        palette={palette}
        observedEdges={controller.rangingEdges}
        viewport={controller.viewport}
        camera={controller.camera}
        onViewportChange={controller.setViewport}
        onSizeChange={controller.setGridSize}
        selectedNodeId={controller.selectedNodeId}
        onSelectNode={controller.setSelectedNodeId}
        showLabels={controller.visibility.labels}
        labelFontFamily={eight2FiveFonts.utilityRegular}
        showGrid={controller.grid.showGrid}
        gridIntervalMeters={controller.grid.fixedIntervalMeters}
        showOrigin={controller.grid.showOrigin}
        units={controller.mapUnits}
        areaMode={controller.mapAreaMode}
        areaBounds={controller.selectedAreaBounds}
        editMode={controller.editingEnabled}
        onLongPressCoordinate={(point) => {
          controller.setPendingAnchorCoordinate(point);
          setSettingsOpen(true);
        }}
      />
      {selectedNode ? (
        <VStack
          testID="manager-map-selected-node-details"
          pointerEvents="none"
          style={{
            position: "absolute",
            top: eight2FiveSpacing.sm,
            left: eight2FiveSpacing.sm,
            maxWidth: 280,
            gap: 2,
            paddingHorizontal: eight2FiveSpacing.sm,
            paddingVertical: eight2FiveSpacing.xs,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surfaceRaised,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: theme.text,
              fontFamily: eight2FiveFonts.styleSemibold,
            }}
          >
            {selectedNode.label ?? selectedNode.id}
          </Text>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {displayPositionText}
          </Text>
          {selectedDistances.map((edge) =>
            edge.distanceMeters !== undefined ? (
              <Text
                key={`${edge.sourceId}:${edge.targetId}`}
                selectable
                size="sm"
                style={{ color: theme.textMuted }}
              >
                {formatRangingEdge(
                  edge,
                  controller.mapUnits,
                  nodeById.get(edge.targetId),
                )}
              </Text>
            ) : null,
          )}
        </VStack>
      ) : null}
      {settingsOpen ? (
        <ManagerMapSettingsModal
          controller={controller}
          isOpen
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </View>
  );
}

function formatRangingEdge(
  edge: PansGridObservedEdge,
  units: MapUnits,
  targetNode?: PansGridNode,
): string {
  const label = targetNode
    ? `${targetNode.label ?? targetNode.id.slice(0, 6)} `
    : "";
  if (edge.distanceMeters === undefined) return `${label}Range unavailable`;
  return `${label}${formatMapDistance(edge.distanceMeters, units)}${
    edge.quality !== undefined ? ` · quality ${edge.quality}` : ""
  }`;
}
