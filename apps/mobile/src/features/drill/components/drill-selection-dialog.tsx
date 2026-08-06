import React from "react";
import { useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import {
  Modal,
  ModalBackdrop,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { DrillListItem } from "./drill-list-item";
import { DrillPropertiesDialog } from "./drill-properties-dialog";
import { PerformerSelectionDialog } from "./performer-selection-dialog";
import { useDrillListController } from "../use-drill-list-controller";

export function DrillSelectionDialog({
  isOpen,
  onClose,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const theme = useEight2FiveTheme();
  const controller = useDrillListController();

  const renderItem = React.useCallback(
    ({ item }: { item: (typeof controller.entries)[number] }) => (
      <DrillListItem
        drill={item.drill}
        pageCount={item.pageCount}
        terms={controller.terms}
        active={controller.activeDrillId === item.drill.id}
        busy={controller.busyDrillId === item.drill.id}
        onOpenInfo={() => void controller.openProperties(item.drill)}
        onSelectPerformer={() =>
          void controller.openPerformerSelection(item.drill)
        }
        onToggleActive={() =>
          void controller.toggleActive(item.drill).catch(() => undefined)
        }
      />
    ),
    [controller],
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalBackdrop />
        <ModalContent style={{ maxHeight: Math.max(360, height * 0.84) }}>
          <ModalHeader className="items-center justify-between">
            <Heading size="md">Select Drill</Heading>
            <ModalCloseButton accessibilityLabel="Close drill selector">
              <Icon as={X} />
            </ModalCloseButton>
          </ModalHeader>
          <FlatList
            data={controller.entries}
            keyExtractor={(entry) => entry.drill.id}
            renderItem={renderItem}
            style={{ maxHeight: Math.max(260, height * 0.66) }}
            contentContainerStyle={{
              gap: eight2FiveSpacing.sm,
              padding: eight2FiveSpacing.md,
            }}
            ListEmptyComponent={
              <VStack style={{ paddingVertical: eight2FiveSpacing.lg }}>
                <Text style={{ color: theme.textMuted }}>
                  No drills uploaded.
                </Text>
              </VStack>
            }
            testID="drill-selection-list"
          />
        </ModalContent>
      </Modal>

      <PerformerSelectionDialog
        key={
          controller.performerDialog
            ? `performer:${controller.performerDialog.drill?.id}:${controller.performerDialog.drill?.selectedPerformerEntityId ?? "none"}`
            : "selector-performer:closed"
        }
        document={controller.performerDialog?.document}
        isOpen={Boolean(controller.performerDialog)}
        importing={controller.busyDrillId !== undefined}
        error={controller.performerError}
        selectedPerformerEntityId={
          controller.performerDialog?.drill?.selectedPerformerEntityId
        }
        title="Change performer"
        confirmLabel="Save"
        onClose={controller.closePerformerSelection}
        onConfirm={controller.selectPerformer}
      />

      <DrillPropertiesDialog
        key={
          controller.propertiesDialog
            ? `selector-info:${controller.propertiesDialog.drill.id}:${controller.propertiesDialog.drill.updatedAt}`
            : "selector-info:closed"
        }
        drill={controller.propertiesDialog?.drill}
        document={controller.propertiesDialog?.document}
        terms={controller.terms}
        isOpen={Boolean(controller.propertiesDialog)}
        loading={controller.propertiesLoading}
        saving={
          controller.busyDrillId === controller.propertiesDialog?.drill.id
        }
        error={controller.propertiesError}
        onClose={controller.closeProperties}
        onDelete={async () => {
          const drill = controller.propertiesDialog?.drill;
          if (!drill) return;
          await controller.remove(drill);
        }}
      />
    </>
  );
}
