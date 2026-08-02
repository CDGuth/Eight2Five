import { Alert } from "react-native";
import { Flag, Pencil, Plus, Trash2 } from "lucide-react-native";
import {
  formatSetName,
  type DrillSet,
  type DrillTerms,
} from "@eight2five/mobile/drill";
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

export function confirmDeletePage(
  page: DrillSet,
  _terms: DrillTerms,
  onConfirm: () => void,
) {
  Alert.alert(
    `Delete Set ${formatSetName(page)}?`,
    "This permanently deletes the set.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ],
  );
}

export function DrillPageActionsSheet({
  page,
  terms: _terms,
  drillActive,
  selected,
  onClose,
  onSelect,
  onEdit,
  onInsertBefore,
  onInsertAfter,
  onDelete,
}: {
  page?: DrillSet;
  terms?: DrillTerms;
  drillActive: boolean;
  selected: boolean;
  onClose(): void;
  onSelect(): void;
  onEdit(): void;
  onInsertBefore(): void;
  onInsertAfter(): void;
  onDelete(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Actionsheet isOpen={Boolean(page)} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        {drillActive && !selected ? (
          <ActionsheetItem onPress={onSelect} accessibilityRole="button">
            <ActionsheetIcon as={Flag} />
            <ActionsheetItemText>Select Set</ActionsheetItemText>
          </ActionsheetItem>
        ) : null}
        <ActionsheetItem onPress={onEdit} accessibilityRole="button">
          <ActionsheetIcon as={Pencil} />
          <ActionsheetItemText>Edit Set</ActionsheetItemText>
        </ActionsheetItem>
        <ActionsheetItem onPress={onInsertBefore} accessibilityRole="button">
          <ActionsheetIcon as={Plus} />
          <ActionsheetItemText>Insert set before</ActionsheetItemText>
        </ActionsheetItem>
        <ActionsheetItem onPress={onInsertAfter} accessibilityRole="button">
          <ActionsheetIcon as={Plus} />
          <ActionsheetItemText>Insert set after</ActionsheetItemText>
        </ActionsheetItem>
        <ActionsheetItem onPress={onDelete} accessibilityRole="button">
          <ActionsheetIcon as={Trash2} style={{ color: theme.danger }} />
          <ActionsheetItemText style={{ color: theme.danger }}>
            Delete Set
          </ActionsheetItemText>
        </ActionsheetItem>
      </ActionsheetContent>
    </Actionsheet>
  );
}
