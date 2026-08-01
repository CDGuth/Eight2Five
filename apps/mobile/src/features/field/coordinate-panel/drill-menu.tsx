import { MenuView } from "@expo/ui/community/menu";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { ChevronDown, Flag } from "lucide-react-native";
import type { Drill } from "@eight2five/mobile/drill";

import { createDrillMenuActions, NO_DRILL_ACTION_ID } from "./drill-menu-state";

export function DrillMenu({
  drills,
  activeDrill,
  disabled,
  onSelect,
}: {
  readonly drills: readonly Drill[];
  readonly activeDrill?: Drill;
  readonly disabled: boolean;
  readonly onSelect: (drillId: string | null) => void;
}) {
  return (
    <MenuView
      actions={createDrillMenuActions(
        drills,
        activeDrill?.id ?? null,
        disabled,
      )}
      onPressAction={({ nativeEvent }) => {
        if (disabled) return;
        onSelect(
          nativeEvent.event === NO_DRILL_ACTION_ID ? null : nativeEvent.event,
        );
      }}
      testID="active-drill-menu"
    >
      <Pressable
        accessibilityLabel={`Active drill, ${activeDrill?.name ?? "none"}`}
        accessibilityRole="button"
        disabled={disabled}
        className="min-h-12 max-w-48 justify-center rounded-xl px-2"
      >
        <HStack className="items-center" style={{ gap: 5 }}>
          {activeDrill ? (
            <Icon as={Flag} size={16} style={{ color: "#FFFFFF" }} />
          ) : null}
          <Text
            className="min-w-0 flex-shrink"
            numberOfLines={1}
            size="xs"
            style={{ color: "#FFFFFF" }}
          >
            {activeDrill?.name ?? "No drill selected"}
          </Text>
          <Icon as={ChevronDown} size={15} style={{ color: "#FFFFFF" }} />
        </HStack>
      </Pressable>
    </MenuView>
  );
}
