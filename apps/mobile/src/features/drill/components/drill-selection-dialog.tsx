import React from "react";
import { useWindowDimensions } from "react-native";
import { CircleCheck, X } from "lucide-react-native";
import type { Drill, DrillTerms } from "@eight2five/mobile/drill";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import {
  Modal,
  ModalBackdrop,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@eight2five/ui/components/modal";
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
import { formatDrillCount } from "../drill-management";

export interface DrillSelectionEntry {
  readonly drill: Drill;
  readonly pageCount: number;
}

export function DrillSelectionDialog({
  entries,
  terms,
  activeDrillId,
  isOpen,
  disabled,
  onClose,
  onSelect,
}: {
  readonly entries: readonly DrillSelectionEntry[];
  readonly terms: DrillTerms;
  readonly activeDrillId: string | null;
  readonly isOpen: boolean;
  readonly disabled: boolean;
  readonly onClose: () => void;
  readonly onSelect: (drillId: string) => void;
}) {
  const { height } = useWindowDimensions();
  if (!isOpen) return null;
  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent style={{ maxHeight: Math.max(320, height * 0.82) }}>
        <ModalHeader className="items-center justify-between">
          <Heading size="md">Select Drill</Heading>
          <ModalCloseButton accessibilityLabel="Close drill selector">
            <Icon as={X} />
          </ModalCloseButton>
        </ModalHeader>
        <DrillSelectionList
          entries={entries}
          terms={terms}
          activeDrillId={activeDrillId}
          disabled={disabled}
          maxHeight={Math.max(220, height * 0.62)}
          onSelect={onSelect}
        />
      </ModalContent>
    </Modal>
  );
}

/** Shared selection-only list body for field and future drill pickers. */
export function DrillSelectionList({
  entries,
  terms,
  activeDrillId,
  disabled,
  maxHeight,
  onSelect,
}: {
  readonly entries: readonly DrillSelectionEntry[];
  readonly terms: DrillTerms;
  readonly activeDrillId: string | null;
  readonly disabled: boolean;
  readonly maxHeight?: number;
  readonly onSelect: (drillId: string) => void;
}) {
  const theme = useEight2FiveTheme();
  const renderItem = React.useCallback(
    ({ item }: { item: DrillSelectionEntry }) => {
      const active = item.drill.id === activeDrillId;
      const DrillIcon = resolveDrillIcon(item.drill.metadata?.lucideIcon);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.drill.name}`}
          accessibilityState={{ disabled, selected: active }}
          disabled={disabled}
          onPress={() => onSelect(item.drill.id)}
          style={{
            minHeight: 64,
            justifyContent: "center",
            borderRadius: eight2FiveRadii.md,
            borderWidth: active ? 2 : 1,
            borderColor: active ? theme.accent : theme.border,
            backgroundColor: active ? theme.accentSoft : theme.surfaceRaised,
            padding: eight2FiveSpacing.sm,
          }}
          testID={`drill-selection-${item.drill.id}`}
        >
          <HStack
            className="items-center"
            style={{ gap: eight2FiveSpacing.sm }}
          >
            <Icon as={DrillIcon} size="xl" style={{ color: theme.text }} />
            <VStack className="flex-1" style={{ gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleSemibold,
                }}
              >
                {item.drill.name}
              </Text>
              <Text size="sm" style={{ color: theme.textMuted }}>
                {formatDrillCount(item.pageCount, terms)}
              </Text>
            </VStack>
            {active ? (
              <Icon
                as={CircleCheck}
                size="lg"
                style={{ color: theme.accent }}
              />
            ) : null}
          </HStack>
        </Pressable>
      );
    },
    [activeDrillId, disabled, onSelect, terms, theme],
  );

  return (
    <FlatList
      data={entries as DrillSelectionEntry[]}
      keyExtractor={(entry) => entry.drill.id}
      renderItem={renderItem}
      style={maxHeight === undefined ? undefined : { maxHeight }}
      contentContainerStyle={{ gap: eight2FiveSpacing.sm }}
      ListEmptyComponent={
        <Text style={{ color: theme.textMuted }}>No drills uploaded.</Text>
      }
      testID="drill-selection-list"
    />
  );
}
