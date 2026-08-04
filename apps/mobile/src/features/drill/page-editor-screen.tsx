import { Stack, useRouter } from "expo-router";
import { Save, X } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { SettingsMessage } from "../settings/settings-components";
import { MarchingCoordinateForm } from "./components/marching-coordinate-form";
import type { PagePlacement } from "./page-management";
import { usePageEditorController } from "./use-page-editor-controller";

export function PageEditorScreen({
  drillId,
  pageId,
  placement = "append",
  relativePageId,
}: {
  drillId: string;
  pageId: string;
  placement?: PagePlacement;
  relativePageId?: string;
}) {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const controller = usePageEditorController(
    drillId,
    pageId,
    placement,
    relativePageId,
  );
  const title = `${pageId === "new" ? "Add" : "Edit"} Set`;

  return (
    <VStack className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: eight2FiveSpacing.md,
          padding: eight2FiveSpacing.md,
          paddingBottom: eight2FiveSpacing.xxl,
        }}
      >
        {controller.loading ? (
          <Text style={{ color: theme.textMuted }}>Loading set…</Text>
        ) : null}
        {controller.error ? (
          <SettingsMessage tone="error">
            {controller.error.message}
          </SettingsMessage>
        ) : null}
        {controller.draft ? (
          <MarchingCoordinateForm
            draft={controller.draft}
            fieldPreset={controller.fieldPreset}
            disabled={controller.saving}
            onChange={controller.setDraft}
          />
        ) : null}
        <HStack style={{ gap: eight2FiveSpacing.sm }}>
          <Button
            className="flex-1"
            variant="outline"
            onPress={() => router.back()}
            isDisabled={controller.saving}
          >
            <ButtonIcon as={X} />
            <ButtonText>Cancel</ButtonText>
          </Button>
          <Button
            className="flex-1"
            onPress={() => {
              void controller
                .save()
                .then(() => router.back())
                .catch(() => undefined);
            }}
            isDisabled={!controller.draft || controller.saving}
            accessibilityState={{
              busy: controller.saving,
              disabled: !controller.draft || controller.saving,
            }}
          >
            {controller.saving ? <ButtonSpinner /> : <ButtonIcon as={Save} />}
            <ButtonText>Save Set</ButtonText>
          </Button>
        </HStack>
      </ScrollView>
    </VStack>
  );
}
