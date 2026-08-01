import React from "react";
import { EllipsisVertical } from "lucide-react-native";
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

export const DrillListItem = React.memo(function DrillListItem({
  drill,
  pageCount,
  terms,
  active,
  busy,
  onOpen,
  onOpenActions,
}: {
  drill: Drill;
  pageCount: number;
  terms: DrillTerms;
  active: boolean;
  busy: boolean;
  onOpen(): void;
  onOpenActions(): void;
}) {
  const theme = useEight2FiveTheme();
  const countLabel = `${pageCount} ${
    pageCount === 1 ? terms.singular : terms.plural
  }`;
  return (
    <Card
      className="p-0"
      style={{
        borderRadius: eight2FiveRadii.md,
        borderColor: active ? theme.accent : theme.border,
        backgroundColor: theme.surfaceRaised,
      }}
    >
      <HStack className="items-center">
        <Pressable
          className="flex-1"
          onPress={onOpen}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${drill.name}, ${countLabel}${active ? ", Active" : ""}`}
          accessibilityHint="Opens the drill editor"
        >
          <VStack style={{ gap: 2, padding: eight2FiveSpacing.md }}>
            <Text
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
            {active ? (
              <Text
                size="sm"
                style={{
                  color: theme.accent,
                  fontFamily: eight2FiveFonts.utilitySemibold,
                }}
              >
                Active
              </Text>
            ) : null}
          </VStack>
        </Pressable>
        <Pressable
          className="min-h-12 min-w-12 items-center justify-center"
          onPress={onOpenActions}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${drill.name}`}
        >
          <Icon as={EllipsisVertical} size="lg" style={{ color: theme.icon }} />
        </Pressable>
      </HStack>
    </Card>
  );
});
