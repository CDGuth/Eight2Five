import React from "react";
import {
  CirclePlus,
  CircleUserRound,
  CircleX,
  Info,
} from "lucide-react-native";
import type { Drill, DrillTerms } from "@eight2five/mobile/drill";
import { Card } from "@eight2five/ui/components/card";
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
  const DrillIcon = resolveDrillIcon(drill.metadata?.lucideIcon);

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
      <HStack
        className="items-center"
        style={{ padding: eight2FiveSpacing.sm }}
      >
        <VStack
          className="items-center justify-center"
          style={{
            width: 48,
            height: 56,
            marginRight: eight2FiveSpacing.sm,
          }}
        >
          <Icon as={DrillIcon} size="xl" style={{ color: theme.text }} />
        </VStack>
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
        <HStack style={{ gap: eight2FiveSpacing.xs }}>
          <DrillActionButton
            label={actionLabels.info}
            icon={Info}
            disabled={busy}
            onPress={onOpenInfo}
            backgroundColor={theme.raw.black}
            iconColor={theme.raw.white}
          />
          <DrillActionButton
            label={actionLabels.performer}
            icon={CircleUserRound}
            disabled={busy}
            onPress={onSelectPerformer}
            backgroundColor={theme.raw.black}
            iconColor={theme.raw.white}
          />
          <Pressable
            onPress={onToggleActive}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              active ? actionLabels.deactivate : actionLabels.activate
            }
            accessibilityState={{ disabled: busy, selected: active }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: active ? 0 : 2,
              borderColor: theme.accent,
              backgroundColor: active ? theme.accent : "transparent",
            }}
          >
            <Icon
              as={active ? CircleX : CirclePlus}
              size="lg"
              style={{ color: active ? theme.raw.white : theme.accent }}
            />
          </Pressable>
        </HStack>
      </HStack>
    </Card>
  );
});

function DrillActionButton({
  label,
  icon,
  disabled,
  onPress,
  backgroundColor,
  iconColor,
}: {
  readonly label: string;
  readonly icon: React.ElementType;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly backgroundColor: string;
  readonly iconColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
      }}
    >
      <Icon as={icon} size="lg" style={{ color: iconColor }} />
    </Pressable>
  );
}
