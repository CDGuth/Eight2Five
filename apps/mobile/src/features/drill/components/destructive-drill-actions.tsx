import { Alert } from "react-native";
import { Check, Pencil, Trash2 } from "lucide-react-native";
import type { Drill, DrillTerms } from "@eight2five/mobile/drill";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetIcon,
  ActionsheetItem,
  ActionsheetItemText,
} from "@eight2five/ui/components/actionsheet";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

export function confirmDeleteDrill(
  drill: Drill,
  terms: DrillTerms,
  onConfirm: () => void,
) {
  Alert.alert(
    `Delete “${drill.name}”?`,
    `This permanently deletes the drill and all of its ${terms.lowercasePlural}.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ],
  );
}

export function DrillActionsSheet({
  drill,
  active,
  onClose,
  onMakeActive,
  onRename,
  onDelete,
}: {
  drill?: Drill;
  active: boolean;
  onClose(): void;
  onMakeActive(): void;
  onRename(): void;
  onDelete(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Actionsheet isOpen={Boolean(drill)} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        {!active ? (
          <ActionsheetItem onPress={onMakeActive} accessibilityRole="button">
            <ActionsheetIcon as={Check} />
            <ActionsheetItemText>Make active</ActionsheetItemText>
          </ActionsheetItem>
        ) : null}
        <ActionsheetItem onPress={onRename} accessibilityRole="button">
          <ActionsheetIcon as={Pencil} />
          <ActionsheetItemText>Rename</ActionsheetItemText>
        </ActionsheetItem>
        <ActionsheetItem onPress={onDelete} accessibilityRole="button">
          <ActionsheetIcon as={Trash2} style={{ color: theme.danger }} />
          <ActionsheetItemText style={{ color: theme.danger }}>
            Delete
          </ActionsheetItemText>
        </ActionsheetItem>
      </ActionsheetContent>
    </Actionsheet>
  );
}
