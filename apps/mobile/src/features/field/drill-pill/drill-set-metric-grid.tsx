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
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";
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
        paddingHorizontal: columns.horizontalPadding,
        paddingVertical: header ? 10 : 8,
      }}
    >
      <MetricCell
        width={columns.setWidth}
        marginRight={columns.setToCountGap}
        visualScale={columns.visualScale}
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
          minHeight: 48,
          marginRight: columns.countToMetricGap,
          alignSelf: "stretch",
          justifyContent: "center",
        }}
      >
        <SwitchingMetricCell
          displayKey={count.key}
          visualScale={columns.visualScale}
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
        style={{
          width: columns.metricWidth,
          minHeight: 48,
          marginRight: columns.metricToCoordinateGap,
          alignSelf: "stretch",
          justifyContent: "center",
        }}
      >
        <SwitchingMetricCell
          displayKey={metric.key}
          visualScale={columns.visualScale}
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
        style={{
          width: columns.coordinateWidth,
          minHeight: 48,
          alignSelf: "stretch",
          justifyContent: "center",
        }}
      >
        <HStack
          className="items-center"
          style={{
            gap: header && onToggleExpanded ? columns.coordinateChevronGap : 0,
            minHeight: 48,
          }}
        >
          <VStack className="flex-1 justify-center" style={{ minWidth: 0 }}>
            <Text
              maxFontSizeMultiplier={1.4}
              style={{
                color: labelColor,
                fontSize: 10 * columns.visualScale,
                lineHeight: 13 * columns.visualScale,
              }}
            >
              Coordinate
            </Text>
            <CoordinateLinesView
              coordinate={presentation.coordinate}
              color={valueColor}
              mutedColor={labelColor}
              fontSize={14 * columns.visualScale}
              lineHeight={17 * columns.visualScale}
              iconSize={12 * columns.visualScale}
            />
          </VStack>
          {header && onToggleExpanded ? (
            <Icon
              as={expanded ? ChevronUp : ChevronDown}
              size="sm"
              style={{ color: labelColor }}
            />
          ) : null}
        </HStack>
      </Pressable>
    </HStack>
  );
});

function MetricCell({
  width,
  marginRight = 0,
  visualScale,
  label,
  value,
  labelColor,
  valueColor,
}: {
  readonly width?: number;
  readonly marginRight?: number;
  readonly visualScale: number;
  readonly label: string;
  readonly value: string;
  readonly labelColor: string;
  readonly valueColor: string;
}) {
  return (
    <VStack
      style={{
        minHeight: 48,
        alignSelf: "stretch",
        justifyContent: "center",
        marginRight,
        ...(width === undefined ? null : { width }),
      }}
    >
      <MetricText
        visualScale={visualScale}
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
  visualScale,
  label,
  value,
  labelColor,
  valueColor,
  modeIndex,
  testID,
}: {
  readonly displayKey: string;
  readonly visualScale: number;
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
          visualScale={visualScale}
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
  visualScale,
  label,
  value,
  labelColor,
  valueColor,
}: {
  readonly visualScale: number;
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
        style={{
          color: labelColor,
          fontSize: 10 * visualScale,
          lineHeight: 13 * visualScale,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        style={{
          color: valueColor,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontSize: 15 * visualScale,
          lineHeight: 18 * visualScale,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </VStack>
  );
}
