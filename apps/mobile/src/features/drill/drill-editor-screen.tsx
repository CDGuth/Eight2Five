import React from "react";
import { useRouter } from "expo-router";
import { Check, Pencil, Plus, Trash2 } from "lucide-react-native";
import type { DrillPage } from "@eight2five/mobile/drill";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Heading } from "@eight2five/ui/components/heading";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SettingsMessage } from "../settings/settings-components";
import { confirmDeleteDrill } from "./components/destructive-drill-actions";
import {
  DrillPageActionsSheet,
  confirmDeletePage,
} from "./components/drill-page-actions";
import { DrillPageListItem } from "./components/drill-page-list-item";
import { DrillNameDialog } from "./components/drill-name-dialog";
import { DrillNameForm } from "./components/drill-name-form";
import { useDrillEditorController } from "./use-drill-editor-controller";

export function DrillEditorScreen({ drillId }: { drillId?: string }) {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const controller = useDrillEditorController(drillId);
  const [renaming, setRenaming] = React.useState(false);
  const [actionPage, setActionPage] = React.useState<DrillPage>();

  const openPage = React.useCallback(
    (page: DrillPage) => {
      if (!drillId) return;
      router.push({
        pathname: "/(tabs)/drill/[drillId]/page/[pageId]",
        params: { drillId, pageId: page.id },
      });
    },
    [drillId, router],
  );

  const renderPage = React.useCallback(
    ({ item, index }: { item: DrillPage; index: number }) => (
      <DrillPageListItem
        page={item}
        previousPage={controller.pages[index - 1]}
        terms={controller.terms}
        selected={controller.selectedPageId === item.id}
        busy={controller.busyPageId === item.id}
        first={index === 0}
        last={index === controller.pages.length - 1}
        onEdit={() => openPage(item)}
        onMoveUp={() => {
          void controller.move(item, "up").catch(() => undefined);
        }}
        onMoveDown={() => {
          void controller.move(item, "down").catch(() => undefined);
        }}
        onOpenActions={() => setActionPage(item)}
      />
    ),
    [controller, openPage],
  );

  if (!drillId) {
    return (
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{
          gap: eight2FiveSpacing.md,
          padding: eight2FiveSpacing.md,
        }}
      >
        <Heading style={{ color: theme.text }}>Create Drill</Heading>
        <Text style={{ color: theme.textMuted }}>
          Name the drill before entering {controller.terms.lowercasePlural}.
        </Text>
        <DrillNameForm
          submitLabel="Create Drill"
          saving={controller.saving}
          onSubmit={async (name) => {
            const created = await controller.saveName(name);
            router.replace(`/(tabs)/drill/${created.id}`);
          }}
        />
      </ScrollView>
    );
  }

  const drill = controller.drill;
  const deleteDrill = () => {
    if (!drill) return;
    confirmDeleteDrill(drill, controller.terms, () => {
      void controller
        .remove()
        .then(() => router.replace("/(tabs)/drill"))
        .catch(() => undefined);
    });
  };

  const insertRelativeToActionPage = (placement: "before" | "after") => {
    const page = actionPage;
    setActionPage(undefined);
    if (!page) return;
    router.push({
      pathname: "/(tabs)/drill/[drillId]/page/[pageId]",
      params: {
        drillId,
        pageId: "new",
        placement,
        relativePageId: page.id,
      },
    });
  };

  const deleteActionPage = () => {
    const page = actionPage;
    setActionPage(undefined);
    if (!page) return;
    confirmDeletePage(page, controller.terms, () => {
      void controller.removePage(page).catch(() => undefined);
    });
  };

  return (
    <VStack className="flex-1" style={{ backgroundColor: theme.background }}>
      <FlatList
        data={controller.pages}
        keyExtractor={(page) => page.id}
        renderItem={renderPage}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          gap: eight2FiveSpacing.sm,
          padding: eight2FiveSpacing.md,
          paddingBottom: eight2FiveSpacing.xxl,
        }}
        ListHeaderComponent={
          <VStack style={{ gap: eight2FiveSpacing.md, marginBottom: 8 }}>
            {controller.loading ? (
              <Text style={{ color: theme.textMuted }}>Loading drill…</Text>
            ) : null}
            {controller.error ? (
              <SettingsMessage tone="error">
                {controller.error.message}
              </SettingsMessage>
            ) : null}
            {drill ? (
              <>
                <Card
                  style={{
                    gap: eight2FiveSpacing.sm,
                    borderColor: controller.active
                      ? theme.accent
                      : theme.border,
                    borderRadius: eight2FiveRadii.md,
                    backgroundColor: theme.surfaceRaised,
                  }}
                >
                  <Heading
                    style={{
                      color: theme.text,
                      fontFamily: eight2FiveFonts.styleBold,
                    }}
                  >
                    {drill.name}
                  </Heading>
                  <Text style={{ color: theme.textMuted }}>
                    {controller.pages.length}{" "}
                    {controller.pages.length === 1
                      ? controller.terms.singular
                      : controller.terms.plural}
                  </Text>
                  <Text
                    style={{
                      color: controller.active ? theme.accent : theme.textMuted,
                    }}
                  >
                    {controller.active ? "Active" : "Inactive"}
                  </Text>
                </Card>

                <VStack style={{ gap: eight2FiveSpacing.sm }}>
                  <Button
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/drill/[drillId]/page/[pageId]",
                        params: {
                          drillId,
                          pageId: "new",
                          placement: "append",
                        },
                      })
                    }
                    isDisabled={controller.saving}
                    accessibilityLabel={`Add ${controller.terms.singular}`}
                  >
                    <ButtonIcon as={Plus} />
                    <ButtonText>Add {controller.terms.singular}</ButtonText>
                  </Button>
                  {!controller.active ? (
                    <Button
                      variant="outline"
                      onPress={() => {
                        void controller.makeActive().catch(() => undefined);
                      }}
                      isDisabled={controller.saving}
                    >
                      <ButtonIcon as={Check} />
                      <ButtonText>Make active</ButtonText>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onPress={() => setRenaming(true)}
                    isDisabled={controller.saving}
                  >
                    <ButtonIcon as={Pencil} />
                    <ButtonText>Rename</ButtonText>
                  </Button>
                  <Button
                    variant="destructive"
                    onPress={deleteDrill}
                    isDisabled={controller.saving}
                  >
                    {controller.saving ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={Trash2} />
                    )}
                    <ButtonText>Delete Drill</ButtonText>
                  </Button>
                </VStack>
                <Heading size="sm" style={{ color: theme.text }}>
                  {controller.terms.plural}
                </Heading>
              </>
            ) : null}
          </VStack>
        }
        ListEmptyComponent={
          !controller.loading && drill ? (
            <Text style={{ color: theme.textMuted }}>
              No {controller.terms.lowercasePlural} yet. Add one to begin.
            </Text>
          ) : null
        }
      />

      {drill ? (
        <DrillNameDialog
          isOpen={renaming}
          initialValue={drill.name}
          saving={controller.saving}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            await controller.saveName(name);
            setRenaming(false);
          }}
        />
      ) : null}
      <DrillPageActionsSheet
        page={actionPage}
        terms={controller.terms}
        drillActive={controller.active}
        selected={controller.selectedPageId === actionPage?.id}
        onClose={() => setActionPage(undefined)}
        onSelect={() => {
          const page = actionPage;
          setActionPage(undefined);
          if (page) void controller.selectPage(page).catch(() => undefined);
        }}
        onEdit={() => {
          const page = actionPage;
          setActionPage(undefined);
          if (page) openPage(page);
        }}
        onInsertBefore={() => insertRelativeToActionPage("before")}
        onInsertAfter={() => insertRelativeToActionPage("after")}
        onDelete={deleteActionPage}
      />
    </VStack>
  );
}
