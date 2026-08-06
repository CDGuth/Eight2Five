import React from "react";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { FieldPresetId } from "@eight2five/drill-schema";
import type { DrillSet, DrillTerminology } from "@eight2five/mobile/drill";
import type {
  CoordinateRoundingSteps,
  TransitionMetricMode,
} from "@eight2five/mobile/settings";
import { Divider } from "@eight2five/ui/components/divider";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import {
  getDrillSetHudPresentation,
  type CountDisplayMode,
} from "../field-hud-state";
import { getDrillPillColumnMetrics } from "./drill-pill-layout";
import { DRILL_SET_ROW_HEIGHT, DrillSetList } from "./drill-set-list";
import { DrillSetMetricGrid } from "./drill-set-metric-grid";
import { FrostedFieldSurface } from "../field-frosted-surface";

export function DrillPill({
  width,
  landscape,
  listMaxHeight,
  pages,
  selectedIndex,
  terminology,
  countDisplayMode,
  metricMode,
  fieldPreset,
  coordinateRoundingSteps,
  expanded,
  controlsDisabled,
  error,
  onToggleCounts,
  onToggleMetric,
  onToggleExpanded,
  onSelectIndex,
}: {
  readonly width: number;
  readonly landscape: boolean;
  readonly listMaxHeight: number;
  readonly pages: readonly DrillSet[];
  readonly selectedIndex: number;
  readonly terminology: DrillTerminology;
  readonly countDisplayMode: CountDisplayMode;
  readonly metricMode: TransitionMetricMode;
  readonly fieldPreset: FieldPresetId;
  readonly coordinateRoundingSteps: CoordinateRoundingSteps;
  readonly expanded: boolean;
  readonly controlsDisabled: boolean;
  readonly error?: Error;
  readonly onToggleCounts: () => void;
  readonly onToggleMetric: () => void;
  readonly onToggleExpanded?: () => void;
  readonly onSelectIndex: (index: number) => void;
}) {
  const theme = useEight2FiveTheme();
  const columns = React.useMemo(
    () => getDrillPillColumnMetrics(width, landscape),
    [landscape, width],
  );
  const current = selectedIndex >= 0 ? pages[selectedIndex] : undefined;
  const presentation = getDrillSetHudPresentation({
    page: current,
    previousPage: selectedIndex > 0 ? pages[selectedIndex - 1] : undefined,
    metricMode,
    fieldPreset,
    terminology,
    coordinateRoundingSteps,
  });
  const availableListHeight = Math.min(
    listMaxHeight,
    Math.max(0, pages.length * DRILL_SET_ROW_HEIGHT + 1),
  );
  const effectiveExpanded = Boolean(onToggleExpanded && expanded);
  const animatedHeight = useSharedValue(
    effectiveExpanded ? availableListHeight : 0,
  );
  React.useEffect(() => {
    animatedHeight.value = withTiming(
      effectiveExpanded ? availableListHeight : 0,
      {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      },
    );
  }, [animatedHeight, availableListHeight, effectiveExpanded]);
  const listStyle = useAnimatedStyle(() => ({ height: animatedHeight.value }));

  return (
    <FrostedFieldSurface
      accessibilityLabel="Drill controls"
      borderRadius={eight2FiveRadii.lg}
      style={{ width }}
      testID="drill-pill"
    >
      <DrillSetMetricGrid
        presentation={presentation}
        columns={columns}
        countDisplayMode={countDisplayMode}
        metricMode={metricMode}
        header
        expanded={effectiveExpanded}
        onToggleCounts={controlsDisabled ? undefined : onToggleCounts}
        onToggleMetric={controlsDisabled ? undefined : onToggleMetric}
        onToggleExpanded={controlsDisabled ? undefined : onToggleExpanded}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          size="xs"
          style={{
            color: theme.danger,
            paddingHorizontal: eight2FiveSpacing.md,
            paddingBottom: eight2FiveSpacing.xs,
          }}
        >
          {error.message}
        </Text>
      ) : null}
      <Animated.View style={[{ overflow: "hidden" }, listStyle]}>
        <Divider style={{ backgroundColor: theme.border }} />
        <DrillSetList
          pages={pages}
          selectedIndex={selectedIndex}
          columns={columns}
          countDisplayMode={countDisplayMode}
          metricMode={metricMode}
          terminology={terminology}
          fieldPreset={fieldPreset}
          coordinateRoundingSteps={coordinateRoundingSteps}
          expanded={effectiveExpanded}
          onSelectIndex={onSelectIndex}
        />
      </Animated.View>
    </FrostedFieldSurface>
  );
}
