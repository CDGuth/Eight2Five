import React from "react";
import { Animated, Easing } from "react-native";
import {
  BluetoothConnected,
  BluetoothOff,
  LoaderCircle,
  RulerDimensionLine,
  TriangleAlert,
} from "lucide-react-native";
import type {
  FieldConnectionState,
  FieldLivePositionState,
  FieldPoint,
} from "@eight2five/mobile/field";
import type { FieldPresetId } from "@eight2five/drill-schema";
import type { CoordinateRoundingSteps } from "@eight2five/mobile/settings";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import {
  getLiveCoordinateLines,
  getTargetDistancePresentation,
  type DistanceTone,
} from "./live-position-hud-state";
import { CoordinateLinesView } from "./coordinate-lines-view";
import { FrostedFieldSurface } from "./field-frosted-surface";

const LIVE_POSITION_REFERENCE_DIAMETER = 156;
const MIN_VISUAL_SCALE = 0.85;
const MAX_VISUAL_SCALE = 1.15;

export function LivePositionSquare({
  diameter,
  live,
  target,
  fieldPreset,
  greenThresholdSteps,
  yellowThresholdSteps,
  coordinateRoundingSteps,
  onOpenTagConnection,
}: {
  readonly diameter: number;
  readonly live: FieldLivePositionState;
  readonly target?: FieldPoint;
  readonly fieldPreset: FieldPresetId;
  readonly greenThresholdSteps: number;
  readonly yellowThresholdSteps: number;
  readonly coordinateRoundingSteps: CoordinateRoundingSteps;
  readonly onOpenTagConnection: () => void;
}) {
  const theme = useEight2FiveTheme();
  const distance = getTargetDistancePresentation({
    live,
    target,
    greenThresholdSteps,
    yellowThresholdSteps,
    roundingSteps: coordinateRoundingSteps,
  });
  const distanceColor = colorForDistanceTone(distance.tone, theme);
  const visualScale = Math.min(
    MAX_VISUAL_SCALE,
    Math.max(MIN_VISUAL_SCALE, diameter / LIVE_POSITION_REFERENCE_DIAMETER),
  );
  const dividerThickness = 1;
  const iconColumnWidth = 32;
  const lowerSectionHeight = Math.max(0, (diameter - dividerThickness) * 0.28);
  const sectionPadding = Math.max(
    0,
    (lowerSectionHeight - iconColumnWidth) / 2,
  );
  const horizontalSectionPadding = sectionPadding * 0.5;
  const rowGap = eight2FiveSpacing.sm;

  const radius = Math.min(eight2FiveRadii.lg, diameter * 0.16);
  return (
    <FrostedFieldSurface
      borderRadius={radius}
      style={{ width: diameter, height: diameter }}
      testID="live-position-square"
    >
      <VStack className="flex-1">
        <VStack style={{ flex: 18 }}>
          <LivePositionHeader
            live={live}
            fieldPreset={fieldPreset}
            compact
            horizontalPadding={sectionPadding}
            leftPadding={sectionPadding}
            gap={rowGap}
            iconColumnWidth={iconColumnWidth}
            visualScale={visualScale}
            coordinateRoundingSteps={coordinateRoundingSteps}
            onOpenTagConnection={onOpenTagConnection}
          />
        </VStack>
        <Divider
          style={{
            height: dividerThickness,
            backgroundColor: theme.border,
          }}
        />
        <HStack
          className="items-center"
          style={{
            flex: 7,
            gap: rowGap,
            paddingLeft: sectionPadding,
            paddingRight: horizontalSectionPadding,
            paddingVertical: sectionPadding * 0.25,
          }}
        >
          <HStack
            className="items-center justify-center"
            style={{ width: iconColumnWidth, height: iconColumnWidth }}
          >
            <Icon
              as={RulerDimensionLine}
              size="lg"
              style={{ color: distanceColor }}
            />
          </HStack>
          <Text
            className="flex-1"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              color: distanceColor,
              fontFamily: eight2FiveFonts.utilitySemibold,
              fontSize: LIVE_POSITION_REFERENCE_DIAMETER * 0.11 * visualScale,
              fontVariant: ["tabular-nums"],
            }}
          >
            {distance.value}
          </Text>
        </HStack>
      </VStack>
    </FrostedFieldSurface>
  );
}

export function LiveOnlyPill({
  width,
  live,
  fieldPreset,
  coordinateRoundingSteps,
  onOpenTagConnection,
}: {
  readonly width: number;
  readonly live: FieldLivePositionState;
  readonly fieldPreset: FieldPresetId;
  readonly coordinateRoundingSteps: CoordinateRoundingSteps;
  readonly onOpenTagConnection: () => void;
}) {
  return (
    <FrostedFieldSurface
      borderRadius={eight2FiveRadii.lg}
      style={{ width, minHeight: 76 }}
      testID="live-only-pill"
    >
      <LivePositionHeader
        live={live}
        fieldPreset={fieldPreset}
        coordinateRoundingSteps={coordinateRoundingSteps}
        onOpenTagConnection={onOpenTagConnection}
      />
    </FrostedFieldSurface>
  );
}

function LivePositionHeader({
  live,
  fieldPreset,
  compact = false,
  horizontalPadding,
  leftPadding,
  gap,
  iconColumnWidth,
  visualScale = 1,
  coordinateRoundingSteps,
  onOpenTagConnection,
}: {
  readonly live: FieldLivePositionState;
  readonly fieldPreset: FieldPresetId;
  readonly compact?: boolean;
  readonly horizontalPadding?: number;
  readonly leftPadding?: number;
  readonly gap?: number;
  readonly iconColumnWidth?: number;
  readonly visualScale?: number;
  readonly coordinateRoundingSteps: CoordinateRoundingSteps;
  readonly onOpenTagConnection: () => void;
}) {
  const theme = useEight2FiveTheme();
  const coordinate = getLiveCoordinateLines(
    live,
    fieldPreset,
    coordinateRoundingSteps,
  );
  return (
    <HStack
      className="flex-1 items-center"
      style={{
        gap: gap ?? (compact ? 6 : eight2FiveSpacing.sm),
        paddingLeft: leftPadding ?? horizontalPadding ?? (compact ? 8 : 12),
        paddingRight: horizontalPadding ?? (compact ? 8 : 12),
        paddingVertical: 8,
      }}
    >
      <BluetoothStatusButton
        state={live.connectionState}
        size={iconColumnWidth}
        onPress={onOpenTagConnection}
      />
      <VStack className="flex-1 justify-center" style={{ minWidth: 0 }}>
        <CoordinateLinesView
          coordinate={coordinate}
          color={theme.text}
          mutedColor={theme.textMuted}
          fontSize={(compact ? 14 : 18) * visualScale}
          lineHeight={(compact ? 18 : 22) * visualScale}
          iconSize={(compact ? 13 : 15) * visualScale}
          maxLinesPerAxis={compact ? 3 : 2}
        />
      </VStack>
    </HStack>
  );
}

function BluetoothStatusButton({
  state,
  size = 44,
  onPress,
}: {
  readonly state: FieldConnectionState;
  readonly size?: number;
  readonly onPress: () => void;
}) {
  const theme = useEight2FiveTheme();
  const [spin] = React.useState(() => new Animated.Value(0));
  const animated = state === "connecting" || state === "reconnecting";
  React.useEffect(() => {
    if (!animated) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [animated, spin]);

  const presentation = getConnectionIconPresentation(state);
  const color =
    presentation.tone === "success"
      ? theme.success
      : presentation.tone === "accent"
        ? theme.accent
        : presentation.tone === "danger"
          ? theme.danger
          : theme.textMuted;
  const icon = <Icon as={presentation.icon} size="lg" style={{ color }} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${presentation.label}. Open tag connection`}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      testID="open-tag-connection"
    >
      {animated ? (
        <Animated.View
          style={{
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          }}
        >
          {icon}
        </Animated.View>
      ) : (
        icon
      )}
    </Pressable>
  );
}

function getConnectionIconPresentation(state: FieldConnectionState) {
  switch (state) {
    case "connected":
      return {
        label: "Connected",
        icon: BluetoothConnected,
        tone: "success" as const,
      };
    case "connecting":
    case "reconnecting":
      return {
        label: state === "connecting" ? "Connecting" : "Reconnecting",
        icon: LoaderCircle,
        tone: "accent" as const,
      };
    case "error":
      return {
        label: "Connection error",
        icon: TriangleAlert,
        tone: "danger" as const,
      };
    case "idle":
    case "disconnected":
      return {
        label: "Disconnected",
        icon: BluetoothOff,
        tone: "muted" as const,
      };
  }
}

function colorForDistanceTone(
  tone: DistanceTone,
  theme: ReturnType<typeof useEight2FiveTheme>,
): string {
  switch (tone) {
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "danger":
      return theme.danger;
    case "muted":
      return theme.textMuted;
  }
}
