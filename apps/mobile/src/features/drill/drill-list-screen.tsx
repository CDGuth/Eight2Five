import React from "react";
import { Stack } from "expo-router";
import { Plus } from "lucide-react-native";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { SettingsMessage } from "../settings/settings-components";
import { DrillEmptyState } from "./components/drill-empty-state";
import { DrillListItem } from "./components/drill-list-item";
import { DrillPropertiesDialog } from "./components/drill-properties-dialog";
import { PerformerSelectionDialog } from "./components/performer-selection-dialog";
import { useDrillListController } from "./use-drill-list-controller";

export function DrillListScreen() {
  const theme = useEight2FiveTheme();
  const controller = useDrillListController();

  const renderItem = React.useCallback(
    ({ item }: { item: (typeof controller.entries)[number] }) => (
      <DrillListItem
        drill={item.drill}
        pageCount={item.pageCount}
        terms={controller.terms}
        active={controller.activeDrillId === item.drill.id}
        busy={controller.uploadBusy || controller.busyDrillId === item.drill.id}
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => void controller.pickFile()}
              accessibilityRole="button"
              accessibilityLabel="Upload Drill"
              hitSlop={8}
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon as={Plus} size="xl" style={{ color: theme.accent }} />
            </Pressable>
          ),
        }}
      />
      <VStack className="flex-1" style={{ backgroundColor: theme.background }}>
        <FlatList
          data={controller.entries}
          keyExtractor={(entry) => entry.drill.id}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            flexGrow: 1,
            gap: eight2FiveSpacing.sm,
            padding: eight2FiveSpacing.md,
            paddingBottom: eight2FiveSpacing.xxl,
          }}
          ListHeaderComponent={
            controller.loading || controller.error ? (
              <VStack style={{ gap: eight2FiveSpacing.sm, marginBottom: 8 }}>
                {controller.loading ? (
                  <Text style={{ color: theme.textMuted }}>
                    Loading drills…
                  </Text>
                ) : null}
                {controller.error ? (
                  <SettingsMessage tone="error">
                    {controller.error.message}
                  </SettingsMessage>
                ) : null}
              </VStack>
            ) : null
          }
          ListEmptyComponent={
            controller.loading ? null : (
              <DrillEmptyState
                terms={controller.terms}
                onUpload={() => void controller.pickFile()}
              />
            )
          }
        />

        <PerformerSelectionDialog
          key={
            controller.pendingImport
              ? `import:${controller.pendingImport.fileName}`
              : controller.performerDialog
                ? `performer:${controller.performerDialog.drill?.id}:${controller.performerDialog.drill?.selectedPerformerEntityId ?? "none"}`
                : "closed"
          }
          document={
            controller.pendingImport?.document ??
            controller.performerDialog?.document
          }
          isOpen={Boolean(
            controller.pendingImport || controller.performerDialog,
          )}
          importing={
            controller.importing || controller.busyDrillId !== undefined
          }
          error={
            controller.pendingImport
              ? controller.importError
              : controller.performerError
          }
          selectedPerformerEntityId={
            controller.performerDialog?.drill?.selectedPerformerEntityId
          }
          title={
            controller.pendingImport ? "Select your dot" : "Change performer"
          }
          confirmLabel={controller.pendingImport ? "Use This Dot" : "Save"}
          onClose={() => {
            if (controller.pendingImport) controller.cancelPendingImport();
            else controller.closePerformerSelection();
          }}
          onConfirm={async (performerEntityId) => {
            if (controller.pendingImport) {
              await controller.importPendingDocument(performerEntityId);
            } else {
              await controller.selectPerformer(performerEntityId);
            }
          }}
        />

        <DrillPropertiesDialog
          key={
            controller.propertiesDialog
              ? `${controller.propertiesDialog.drill.id}:${controller.propertiesDialog.drill.updatedAt}`
              : "closed"
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
          onSave={controller.updateProperties}
          onDelete={async () => {
            const drill = controller.propertiesDialog?.drill;
            if (!drill) return;
            await controller.remove(drill);
          }}
        />
      </VStack>
    </>
  );
}
