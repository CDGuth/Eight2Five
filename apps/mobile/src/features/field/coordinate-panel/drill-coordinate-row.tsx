import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import type { DrillSet, DrillTerminology } from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import { getDrillCoordinatePresentation } from "./coordinate-panel-state";
import { TransitionMetricCell } from "./transition-metric-cell";

function MetadataCell({ label, value }: { label: string; value: string }) {
  return (
    <VStack className="min-h-12 flex-1 items-center justify-center px-1">
      <Text size="xs" style={{ color: "rgba(255,255,255,0.56)" }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        style={{ color: "#FFFFFF", fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </VStack>
  );
}

function DrillCoordinate({
  coordinate,
  emptyMessage,
}: Pick<
  ReturnType<typeof getDrillCoordinatePresentation>,
  "coordinate" | "emptyMessage"
>) {
  return (
    <VStack className="min-w-0 flex-[3] justify-center px-3">
      <Text
        numberOfLines={1}
        selectable
        size="sm"
        style={{ color: coordinate ? "#FFFFFF" : "rgba(255,255,255,0.54)" }}
      >
        {coordinate?.side ?? emptyMessage}
      </Text>
      {coordinate ? (
        <Text
          numberOfLines={1}
          selectable
          size="xs"
          style={{ color: "#FFFFFF" }}
        >
          {coordinate.frontBack}
        </Text>
      ) : null}
    </VStack>
  );
}

export function DrillCoordinateRow({
  page,
  previousPage,
  terminology: _terminology,
  metricMode,
  landscape,
  metricToggleDisabled,
  onToggleMetric,
}: {
  readonly page?: DrillSet;
  readonly previousPage?: DrillSet;
  /** @deprecated Sets are the only terminology; kept for call-site compatibility. */
  readonly terminology?: DrillTerminology;
  readonly metricMode: TransitionMetricMode;
  readonly landscape: boolean;
  readonly metricToggleDisabled: boolean;
  readonly onToggleMetric: () => void;
}) {
  const presentation = getDrillCoordinatePresentation({
    page,
    previousPage,
    metricMode,
  });
  const metadata = (
    <HStack className="min-h-12 flex-1 items-stretch">
      <MetadataCell label="Set" value={presentation.set} />
      <MetadataCell label="Counts" value={presentation.counts} />
      <MetadataCell label="Measures" value={presentation.measures} />
      <TransitionMetricCell
        label={presentation.metricLabel}
        value={presentation.metric}
        disabled={metricToggleDisabled}
        onToggle={onToggleMetric}
      />
    </HStack>
  );

  return landscape ? (
    <HStack className="flex-1 items-stretch" testID="drill-coordinate-landscape">
      {metadata}
      <DrillCoordinate
        coordinate={presentation.coordinate}
        emptyMessage={presentation.emptyMessage}
      />
    </HStack>
  ) : (
    <VStack className="flex-1" testID="drill-coordinate-portrait">
      {metadata}
      <DrillCoordinate
        coordinate={presentation.coordinate}
        emptyMessage={presentation.emptyMessage}
      />
    </VStack>
  );
}
