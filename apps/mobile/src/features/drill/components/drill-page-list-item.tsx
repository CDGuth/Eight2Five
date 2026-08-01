import React from "react";
import { ArrowDown, ArrowUp, EllipsisVertical } from "lucide-react-native";
import type { DrillPage, DrillTerms } from "@eight2five/mobile/drill";
import {
  fieldPointToMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
} from "@eight2five/mobile/field";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
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

import { TransitionSummary } from "./transition-summary";

export const DrillPageListItem = React.memo(function DrillPageListItem({
  page,
  previousPage,
  terms,
  selected,
  busy,
  first,
  last,
  onEdit,
  onMoveUp,
  onMoveDown,
  onOpenActions,
}: {
  page: DrillPage;
  previousPage?: DrillPage;
  terms: DrillTerms;
  selected: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onEdit(): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onOpenActions(): void;
}) {
  const theme = useEight2FiveTheme();
  const coordinate = React.useMemo(
    () => fieldPointToMarchingCoordinate(page.position),
    [page.position],
  );
  const side = formatMarchingSide(coordinate.side);
  const frontBack = formatMarchingFrontBack(coordinate.frontBack);
  const title = `${terms.singular} ${page.label}`;

  return (
    <Card
      className="p-0"
      style={{
        borderRadius: eight2FiveRadii.md,
        borderColor: selected ? theme.accent : theme.border,
        backgroundColor: theme.surfaceRaised,
      }}
    >
      <HStack className="items-start">
        <Pressable
          className="flex-1"
          onPress={onEdit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${page.countsFromPrevious} counts. ${side}. ${frontBack}.${selected ? " Selected." : ""}`}
          accessibilityHint={`Edits this ${terms.lowercaseSingular}`}
          accessibilityState={{ selected, disabled: busy }}
        >
          <VStack
            style={{ gap: eight2FiveSpacing.xs, padding: eight2FiveSpacing.md }}
          >
            <VStack style={{ gap: 2 }}>
              <Text
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleSemibold,
                }}
              >
                {title}
              </Text>
              <Text size="sm" style={{ color: theme.textMuted }}>
                {page.countsFromPrevious} counts
              </Text>
              {selected ? (
                <Text
                  size="sm"
                  style={{
                    color: theme.accent,
                    fontFamily: eight2FiveFonts.utilitySemibold,
                  }}
                >
                  Selected
                </Text>
              ) : null}
            </VStack>
            <Text style={{ color: theme.text }}>{side}</Text>
            <Text style={{ color: theme.text }}>{frontBack}</Text>
            <TransitionSummary previousPage={previousPage} page={page} />
          </VStack>
        </Pressable>
        <Pressable
          className="min-h-12 min-w-12 items-center justify-center"
          onPress={onOpenActions}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${title}`}
          accessibilityState={{ disabled: busy }}
        >
          <Icon as={EllipsisVertical} size="lg" style={{ color: theme.icon }} />
        </Pressable>
      </HStack>
      <HStack
        style={{
          gap: eight2FiveSpacing.sm,
          padding: eight2FiveSpacing.sm,
          paddingTop: 0,
        }}
      >
        <Button
          className="min-h-12 flex-1"
          size="sm"
          variant="outline"
          onPress={onMoveUp}
          isDisabled={busy || first}
          accessibilityLabel={`Move ${title} up`}
        >
          <ButtonIcon as={ArrowUp} />
          <ButtonText>Move Up</ButtonText>
        </Button>
        <Button
          className="min-h-12 flex-1"
          size="sm"
          variant="outline"
          onPress={onMoveDown}
          isDisabled={busy || last}
          accessibilityLabel={`Move ${title} down`}
        >
          <ButtonIcon as={ArrowDown} />
          <ButtonText>Move Down</ButtonText>
        </Button>
      </HStack>
    </Card>
  );
});
