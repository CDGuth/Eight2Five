import React from "react";
import {
  Animated,
  Pressable as NativePressable,
  View,
  type GestureResponderEvent,
} from "react-native";
import {
  CircleCheck,
  CirclePlus,
  CircleUserRound,
  Info,
} from "lucide-react-native";
import type { Drill, DrillTerms } from "@eight2five/mobile/drill";
import { Card } from "@eight2five/ui/components/card";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { resolveDrillIcon } from "../drill-icons";
import {
  formatDrillCount,
  getDrillCardActionLabels,
} from "../drill-management";

export const DrillListItem = React.memo(function DrillListItem({
  drill,
  pageCount,
  terms,
  active,
  busy,
  onOpenInfo,
  onSelectPerformer,
  onToggleActive,
}: {
  readonly drill: Drill;
  readonly pageCount: number;
  readonly terms: DrillTerms;
  readonly active: boolean;
  readonly busy: boolean;
  readonly onOpenInfo: () => void;
  readonly onSelectPerformer: () => void;
  readonly onToggleActive: () => void;
}) {
  const theme = useEight2FiveTheme();
  const countLabel = formatDrillCount(pageCount, terms);
  const actionLabels = getDrillCardActionLabels(drill.name);
  const DrillIcon = drill.metadata?.lucideIcon
    ? resolveDrillIcon(drill.metadata.lucideIcon)
    : undefined;

  return (
    <Card
      className="p-0"
      style={{
        borderRadius: eight2FiveRadii.md,
        borderColor: active ? theme.accent : theme.border,
        borderWidth: active ? 2 : 1,
        backgroundColor: theme.surfaceRaised,
      }}
    >
      <NativePressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? `${drill.name} is active` : actionLabels.activate
        }
        accessibilityState={{ disabled: busy, selected: active }}
        disabled={busy}
        onPress={() => {
          if (!active) onToggleActive();
        }}
        style={({ pressed }) => ({
          opacity: busy ? 0.55 : pressed ? 0.8 : 1,
        })}
      >
        <HStack
          className="items-center"
          style={{ padding: eight2FiveSpacing.sm }}
        >
          {DrillIcon ? (
            <VStack
              className="items-center justify-center"
              style={{
                width: 40,
                height: 48,
                marginRight: eight2FiveSpacing.sm,
              }}
            >
              <Icon as={DrillIcon} size="lg" style={{ color: theme.text }} />
            </VStack>
          ) : null}
          <VStack className="flex-1" style={{ gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontFamily: eight2FiveFonts.styleSemibold,
              }}
            >
              {drill.name}
            </Text>
            <Text size="sm" style={{ color: theme.textMuted }}>
              {countLabel}
            </Text>
          </VStack>
          <HStack className="items-center" style={{ gap: 0 }}>
            <DrillActionButton
              label={actionLabels.info}
              icon={Info}
              disabled={busy}
              onPress={onOpenInfo}
              iconColor={theme.text}
            />
            <DrillActionButton
              label={actionLabels.performer}
              icon={CircleUserRound}
              disabled={busy}
              onPress={onSelectPerformer}
              iconColor={theme.text}
            />
            <NativePressable
              onPress={(event) => {
                event.stopPropagation();
                onToggleActive();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                active ? actionLabels.deactivate : actionLabels.activate
              }
              accessibilityState={{ disabled: busy, selected: active }}
              hitSlop={4}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.45 : pressed ? 0.6 : 1,
              })}
            >
              <AnimatedSelectionIcon active={active} color={theme.accent} />
            </NativePressable>
          </HStack>
        </HStack>
      </NativePressable>
    </Card>
  );
});

function DrillActionButton({
  label,
  icon,
  disabled,
  onPress,
  iconColor,
}: {
  readonly label: string;
  readonly icon: React.ElementType;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly iconColor: string;
}) {
  return (
    <NativePressable
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <View pointerEvents="none">
        <Icon as={icon} size={24} style={{ color: iconColor }} />
      </View>
    </NativePressable>
  );
}

function AnimatedSelectionIcon({
  active,
  color,
}: {
  readonly active: boolean;
  readonly color: string;
}) {
  const [progress] = React.useState(() => new Animated.Value(active ? 1 : 0));
  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const plusOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const checkOpacity = progress;
  const plusScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });
  const checkScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          opacity: plusOpacity,
          transform: [{ scale: plusScale }],
        }}
      >
        <Icon as={CirclePlus} size={30} style={{ color }} />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          opacity: checkOpacity,
          transform: [{ scale: checkScale }],
        }}
      >
        <Icon as={CircleCheck} size={30} style={{ color }} />
      </Animated.View>
    </View>
  );
}
