import React from "react";
import { useRouter } from "expo-router";
import { Check, Pencil, Plus, Trash2 } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
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
import { DrillNameDialog } from "./components/drill-name-dialog";
import { DrillNameForm } from "./components/drill-name-form";
import { useDrillEditorController } from "./use-drill-editor-controller";

export function DrillEditorScreen({ drillId }: { drillId?: string }) {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const controller = useDrillEditorController(drillId);
  const [renaming, setRenaming] = React.useState(false);

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

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{
        gap: eight2FiveSpacing.md,
        padding: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.xxl,
      }}
    >
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
              borderColor: controller.active ? theme.accent : theme.border,
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
                  params: { drillId, pageId: "new", placement: "append" },
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
        </>
      ) : null}
    </ScrollView>
  );
}
