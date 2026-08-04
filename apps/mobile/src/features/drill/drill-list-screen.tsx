import React from "react";
import { Stack, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import type { Drill } from "@eight2five/mobile/drill";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SettingsMessage } from "../settings/settings-components";
import {
  DrillActionsSheet,
  confirmDeleteDrill,
} from "./components/destructive-drill-actions";
import { DrillEmptyState } from "./components/drill-empty-state";
import { DrillListItem } from "./components/drill-list-item";
import { DrillNameDialog } from "./components/drill-name-dialog";
import { useDrillListController } from "./use-drill-list-controller";

export function DrillListScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const controller = useDrillListController();
  const [actionDrill, setActionDrill] = React.useState<Drill>();
  const [renameDrill, setRenameDrill] = React.useState<Drill>();

  const openDrill = React.useCallback(
    (drill: Drill) => router.push(`/(tabs)/drill/${drill.id}`),
    [router],
  );

  const openActions = React.useCallback((drill: Drill) => {
    setActionDrill(drill);
  }, []);

  const renderItem = React.useCallback(
    ({ item }: { item: (typeof controller.entries)[number] }) => (
      <DrillListItem
        drill={item.drill}
        pageCount={item.pageCount}
        terms={controller.terms}
        active={controller.activeDrillId === item.drill.id}
        busy={controller.busyDrillId === item.drill.id}
        onOpen={() => openDrill(item.drill)}
        onOpenActions={() => openActions(item.drill)}
      />
    ),
    [controller, openActions, openDrill],
  );

  const beginRename = () => {
    setRenameDrill(actionDrill);
    setActionDrill(undefined);
  };

  const beginDelete = () => {
    const drill = actionDrill;
    setActionDrill(undefined);
    if (!drill) return;
    confirmDeleteDrill(drill, controller.terms, () => {
      void controller.remove(drill).catch(() => undefined);
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(tabs)/drill/upload")}
              accessibilityRole="button"
              accessibilityLabel="Upload Drill"
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
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
            <VStack style={{ gap: eight2FiveSpacing.md, marginBottom: 8 }}>
              <Heading
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleBold,
                }}
              >
                Drills
              </Heading>
              {controller.loading ? (
                <Text style={{ color: theme.textMuted }}>Loading drills…</Text>
              ) : null}
              {controller.error ? (
                <SettingsMessage tone="error">
                  {controller.error.message}
                </SettingsMessage>
              ) : null}
            </VStack>
          }
          ListEmptyComponent={
            controller.loading ? null : (
              <DrillEmptyState
                terms={controller.terms}
                onUpload={() => router.push("/(tabs)/drill/upload")}
              />
            )
          }
        />

        <DrillActionsSheet
          drill={actionDrill}
          active={controller.activeDrillId === actionDrill?.id}
          onClose={() => setActionDrill(undefined)}
          onMakeActive={() => {
            const drill = actionDrill;
            setActionDrill(undefined);
            if (drill) {
              void controller.makeActive(drill).catch(() => undefined);
            }
          }}
          onRename={beginRename}
          onDelete={beginDelete}
        />
        <DrillNameDialog
          isOpen={Boolean(renameDrill)}
          initialValue={renameDrill?.name ?? ""}
          saving={controller.busyDrillId === renameDrill?.id}
          onClose={() => setRenameDrill(undefined)}
          onSave={async (name) => {
            if (!renameDrill) return;
            await controller.rename(renameDrill, name);
            setRenameDrill(undefined);
          }}
        />
      </VStack>
    </>
  );
}
