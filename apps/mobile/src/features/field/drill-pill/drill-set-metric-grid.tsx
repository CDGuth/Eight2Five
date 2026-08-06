import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import { CoordinateLinesView } from "../coordinate-lines-view";
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
  readonly header?: boolean;
  readonly expanded?: boolean;
  readonly onToggleCounts?: () => void;
  readonly onToggleMetric?: () => void;
  readonly onToggleExpanded?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const labelColor = theme.textMuted;
  const valueColor = theme.text;
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
        pointerEvents={onToggleCounts ? "auto" : "none"}
        onPress={onToggleCounts}
        style={{
          width: columns.countWidth,
          paddingLeft: columns.horizontalPadding,
        }}
      >
        <SwitchingMetricCell
          displayKey={count.key}
          label={count.label}
          value={count.value}
          labelColor={labelColor}
          valueColor={valueColor}
          modeIndex={countDisplayMode === "counts" ? 0 : 1}
          testID={header ? "drill-pill-count-switch" : undefined}
        />
      </Pressable>
      <Pressable
        accessibilityRole={onToggleMetric ? "button" : undefined}
        accessibilityLabel={
          onToggleMetric
            ? `Show ${metricMode === "step-size" ? "xCounts" : "step size"}`
            : undefined
        }
        pointerEvents={onToggleMetric ? "auto" : "none"}
        onPress={onToggleMetric}
        style={{ width: columns.metricWidth }}
      >
        <SwitchingMetricCell
          displayKey={metric.key}
          label={metric.label}
          value={metric.value}
          labelColor={labelColor}
          valueColor={valueColor}
          modeIndex={metricMode === "step-size" ? 0 : 1}
          testID={header ? "drill-pill-metric-switch" : undefined}
        />
      </Pressable>
      <Pressable
        accessibilityRole={onToggleExpanded ? "button" : undefined}
        accessibilityLabel={
          onToggleExpanded
            ? `${expanded ? "Collapse" : "Expand"} drill set list`
            : undefined
        }
        pointerEvents={onToggleExpanded ? "auto" : "none"}
        onPress={onToggleExpanded}
        style={{ width: columns.coordinateWidth }}
      >
        <HStack
          className="flex-1 items-center"
          style={{ gap: 2, minHeight: 48 }}
        >
          <VStack className="flex-1 justify-center" style={{ minWidth: 0 }}>
            <Text
              maxFontSizeMultiplier={1.4}
              size="xs"
              style={{ color: labelColor, lineHeight: 13 }}
            >
              Coordinate
            </Text>
            <CoordinateLinesView
              coordinate={presentation.coordinate}
              color={valueColor}
              mutedColor={labelColor}
              fontSize={14}
              lineHeight={17}
              iconSize={12}
            />
          </VStack>
          {header && onToggleExpanded ? (
            <Icon
              as={expanded ? ChevronUp : ChevronDown}
              size="sm"
              style={{
                color: labelColor,
                marginLeft: eight2FiveSpacing.xs,
              }}
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
    <VStack
      style={{
        height: 48,
        justifyContent: "center",
        ...(width === undefined ? null : { width }),
      }}
    >
      <MetricText
        label={label}
        value={value}
        labelColor={labelColor}
        valueColor={valueColor}
      />
    </VStack>
  );
}

function SwitchingMetricCell({
  displayKey,
  label,
  value,
  labelColor,
  valueColor,
  modeIndex,
  testID,
}: {
  readonly displayKey: string;
  readonly label: string;
  readonly value: string;
  readonly labelColor: string;
  readonly valueColor: string;
  readonly modeIndex: 0 | 1;
  readonly testID?: string;
}) {
  return (
    <HStack className="items-center" style={{ gap: 6, height: 48 }}>
      <ModeIndicator
        modeIndex={modeIndex}
        labelColor={labelColor}
        valueColor={valueColor}
      />
      <AnimatedValueSwitch
        displayKey={displayKey}
        style={{ flex: 1 }}
        testID={testID}
      >
        <MetricText
          label={label}
          value={value}
          labelColor={labelColor}
          valueColor={valueColor}
        />
      </AnimatedValueSwitch>
    </HStack>
  );
}

function ModeIndicator({
  modeIndex,
  labelColor,
  valueColor,
}: {
  readonly modeIndex: 0 | 1;
  readonly labelColor: string;
  readonly valueColor: string;
}) {
  const progress = useSharedValue(modeIndex);
  React.useEffect(() => {
    progress.value = withTiming(modeIndex, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [modeIndex, progress]);

  const topStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [valueColor, labelColor],
    ),
    opacity: 1 - progress.value * 0.5,
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [labelColor, valueColor],
    ),
    opacity: 0.5 + progress.value * 0.5,
  }));
  const dotStyle = {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  } as const;

  return (
    <VStack style={{ gap: 4 }} accessibilityElementsHidden>
      <Animated.View style={[dotStyle, topStyle]} />
      <Animated.View style={[dotStyle, bottomStyle]} />
    </VStack>
  );
}

function MetricText({
  label,
  value,
  labelColor,
  valueColor,
}: {
  readonly label: string;
  readonly value: string;
  readonly labelColor: string;
  readonly valueColor: string;
}) {
  return (
    <VStack className="flex-1 justify-center">
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
