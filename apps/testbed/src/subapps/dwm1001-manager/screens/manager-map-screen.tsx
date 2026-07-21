import React from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Settings2 } from "lucide-react-native";
import { PansNetworkGrid } from "@eight2five/mobile/pans-manager";
import type { PansGridPalette } from "@eight2five/mobile/pans-manager";
import { Button, ButtonIcon } from "@eight2five/ui/components/button";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ManagerMapSettingsModal } from "../components/manager-map-settings-modal";
import { usePansMapDataController } from "../manager-map-controller";

export function ManagerMapScreen({
  initialNetworkId,
}: {
  initialNetworkId?: string;
}) {
  const theme = useEight2FiveTheme();
  const insets = useSafeAreaInsets();
  const controller = usePansMapDataController(initialNetworkId);
  const stopTracking = controller.stopTracking;
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
        showGrid={controller.grid.showGrid}
        gridIntervalMeters={controller.grid.fixedIntervalMeters}
        showOrigin={controller.grid.showOrigin}
        editMode={controller.editingEnabled}
        onLongPressCoordinate={(point) => {
          controller.setPendingAnchorCoordinate(point);
          setSettingsOpen(true);
        }}
      />
      <Button
        testID="manager-map-settings-button"
        accessibilityLabel="Open map settings"
        variant="outline"
        size="icon"
        onPress={() => setSettingsOpen(true)}
        style={{
          position: "absolute",
          top: insets.top + 8,
          right: insets.right + 8,
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
        }}
      >
        <ButtonIcon as={Settings2} style={{ color: theme.icon }} />
      </Button>
      <ManagerMapSettingsModal
        controller={controller}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </View>
  );
}
