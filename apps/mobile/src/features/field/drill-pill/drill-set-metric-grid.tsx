import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import type {
  CountDisplayMode,
  DrillSetHudPresentation,
} from "../field-hud-state";
import { AnimatedValueSwitch } from "./animated-value-switch";
import type { DrillPillColumnMetrics } from "./drill-pill-layout";
import {
  getCountMetricPresentation,
  getTransitionMetricPresentation,
} from "./drill-pill-presentation";

export const DrillSetMetricGrid = React.memo(function DrillSetMetricGrid({
  presentation,
  columns,
  countDisplayMode,
  metricMode,
  selected = false,
  header = false,
  expanded = false,
  onToggleCounts,
  onToggleMetric,
  onToggleExpanded,
}: {
  readonly presentation: DrillSetHudPresentation;
  readonly columns: DrillPillColumnMetrics;
  readonly countDisplayMode: CountDisplayMode;
  readonly metricMode: TransitionMetricMode;
  readonly selected?: boolean;
  readonly header?: boolean;
  readonly expanded?: boolean;
  readonly onToggleCounts?: () => void;
  readonly onToggleMetric?: () => void;
  readonly onToggleExpanded?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const labelColor = selected ? theme.raw.white : theme.textMuted;
  const valueColor = selected ? theme.raw.white : theme.text;
  const count = getCountMetricPresentation(presentation, countDisplayMode);
  const metric = getTransitionMetricPresentation(presentation, metricMode);

  return (
    <HStack
      className="items-stretch"
      style={{
        gap: columns.gap,
        paddingHorizontal: columns.horizontalPadding,
        paddingVertical: header ? 10 : 8,
      }}
    >
      <MetricCell
        width={columns.setWidth}
        label={presentation.term}
        value={presentation.set}
        labelColor={labelColor}
        valueColor={valueColor}
      />
      <Pressable
        accessibilityRole={onToggleCounts ? "button" : undefined}
        accessibilityLabel={
          onToggleCounts
            ? `Show ${countDisplayMode === "counts" ? "measures" : "counts"}`
            : undefined
        }
        disabled={!onToggleCounts}
        pointerEvents={onToggleCounts ? "auto" : "none"}
        onPress={onToggleCounts}
        style={{ width: columns.countWidth }}
      >
        <AnimatedValueSwitch
          displayKey={count.key}
          direction={count.direction}
          testID={header ? "drill-pill-count-switch" : undefined}
        >
          <MetricCell
            label={count.label}
            value={count.value}
            labelColor={labelColor}
            valueColor={valueColor}
          />
        </AnimatedValueSwitch>
      </Pressable>
      <Pressable
        accessibilityRole={onToggleMetric ? "button" : undefined}
        accessibilityLabel={
          onToggleMetric
            ? `Show ${metricMode === "step-size" ? "xCounts" : "step size"}`
            : undefined
        }
        disabled={!onToggleMetric}
        pointerEvents={onToggleMetric ? "auto" : "none"}
        onPress={onToggleMetric}
        style={{ width: columns.metricWidth }}
      >
        <AnimatedValueSwitch
          displayKey={metric.key}
          direction={metric.direction}
          testID={header ? "drill-pill-metric-switch" : undefined}
        >
          <MetricCell
            label={metric.label}
            value={metric.value}
            labelColor={labelColor}
            valueColor={valueColor}
          />
        </AnimatedValueSwitch>
      </Pressable>
      <Pressable
        accessibilityRole={onToggleExpanded ? "button" : undefined}
        accessibilityLabel={
          onToggleExpanded
            ? `${expanded ? "Collapse" : "Expand"} drill set list`
            : undefined
        }
        disabled={!onToggleExpanded}
        pointerEvents={onToggleExpanded ? "auto" : "none"}
        onPress={onToggleExpanded}
        style={{ width: columns.coordinateWidth }}
      >
        <HStack className="flex-1 items-center" style={{ gap: 2 }}>
          <VStack className="flex-1">
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={1.4}
              size="xs"
              style={{ color: labelColor, lineHeight: 13 }}
            >
              Marching Coordinate
            </Text>
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={1.4}
              style={{
                color: valueColor,
                fontFamily: eight2FiveFonts.utilitySemibold,
                fontSize: 14,
                lineHeight: 17,
              }}
            >
              {presentation.coordinate
                ? `${presentation.coordinate.side}\n${presentation.coordinate.frontBack}`
                : "–"}
            </Text>
          </VStack>
          {onToggleExpanded ? (
            <Icon
              as={expanded ? ChevronUp : ChevronDown}
              size="sm"
              style={{ color: labelColor, marginLeft: eight2FiveSpacing.xs }}
            />
          ) : null}
        </HStack>
      </Pressable>
    </HStack>
  );
});

function MetricCell({
  width,
  label,
  value,
  labelColor,
  valueColor,
}: {
  readonly width?: number;
  readonly label: string;
  readonly value: string;
  readonly labelColor: string;
  readonly valueColor: string;
}) {
  return (
    <VStack style={width === undefined ? undefined : { width }}>
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        size="xs"
        style={{ color: labelColor, lineHeight: 13 }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        style={{
          color: valueColor,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontSize: 15,
          lineHeight: 18,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </VStack>
  );
}
