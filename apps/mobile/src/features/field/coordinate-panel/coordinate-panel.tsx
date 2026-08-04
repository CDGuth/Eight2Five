import { Box } from "@eight2five/ui/components/box";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import type { FieldLivePositionState } from "@eight2five/mobile/field";
import type {
  Drill,
  DrillPage,
  DrillTerminology,
} from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";
import type { FieldPresetId } from "@eight2five/drill-schema";

import { ConnectionIndicator } from "./connection-indicator";
import { DrillCoordinateRow } from "./drill-coordinate-row";
import { DrillMenu } from "./drill-menu";
import { LiveCoordinateRow } from "./live-coordinate-row";

export interface CoordinatePanelProps {
  readonly landscape: boolean;
  readonly live: FieldLivePositionState;
  readonly drillFeaturesEnabled: boolean;
  readonly drills: readonly Drill[];
  readonly activeDrill?: Drill;
  readonly selectedPage?: DrillPage;
  readonly previousPage?: DrillPage;
  readonly terminology: DrillTerminology;
  readonly metricMode: TransitionMetricMode;
  readonly fieldPreset: FieldPresetId;
  readonly controlsDisabled: boolean;
  readonly error?: Error;
  readonly onSelectDrill: (drillId: string | null) => void;
  readonly onToggleMetric: () => void;
}

export function CoordinatePanel({
  landscape,
  live,
  drillFeaturesEnabled,
  drills,
  activeDrill,
  selectedPage,
  previousPage,
  terminology,
  metricMode,
  fieldPreset,
  controlsDisabled,
  error,
  onSelectDrill,
  onToggleMetric,
}: CoordinatePanelProps) {
  const height = drillFeaturesEnabled ? (landscape ? 132 : 188) : 76;
  return (
    <VStack
      accessibilityLabel="Field coordinates"
      className="overflow-hidden"
      style={{
        height,
        borderRadius: 26,
        borderCurve: "continuous",
        backgroundColor: "rgba(27,27,29,0.96)",
        boxShadow: "0 5px 18px rgba(0,0,0,0.24)",
      }}
      testID="coordinate-panel"
    >
      <HStack className="h-[76px] items-center px-2" style={{ gap: 6 }}>
        <ConnectionIndicator state={live.connectionState} />
        <LiveCoordinateRow live={live} fieldPreset={fieldPreset} />
        {drillFeaturesEnabled ? (
          <DrillMenu
            drills={drills}
            activeDrill={activeDrill}
            disabled={controlsDisabled}
            onSelect={onSelectDrill}
          />
        ) : null}
      </HStack>
      {drillFeaturesEnabled ? (
        <>
          <Box
            className="h-px"
            style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
          />
          <DrillCoordinateRow
            page={selectedPage}
            previousPage={previousPage}
            terminology={terminology}
            metricMode={metricMode}
            fieldPreset={fieldPreset}
            landscape={landscape}
            metricToggleDisabled={controlsDisabled}
            onToggleMetric={onToggleMetric}
          />
        </>
      ) : null}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          size="xs"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 2,
            color: "#E16B6B",
          }}
        >
          {error.message}
        </Text>
      ) : null}
    </VStack>
  );
}
