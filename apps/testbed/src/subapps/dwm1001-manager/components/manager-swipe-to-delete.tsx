import React from "react";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { Trash2 } from "lucide-react-native";

export interface ManagerSwipeRegistryCallbacks {
  onWillOpen(key: string, methods: SwipeableMethods): void;
  onClose(key: string, methods: SwipeableMethods): void;
}

export function ManagerSwipeToDelete({
  rowKey,
  label,
  enabled = true,
  registry,
  onRequestDelete,
  children,
}: {
  rowKey: string;
  label: string;
  enabled?: boolean;
  registry: ManagerSwipeRegistryCallbacks;
  onRequestDelete(): void;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  const swipeableRef = React.useRef<SwipeableMethods>(null);
  React.useEffect(
    () => () => {
      if (swipeableRef.current) registry.onClose(rowKey, swipeableRef.current);
    },
    [registry, rowKey],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      testID={`swipe-delete-${rowKey}`}
      enabled={enabled}
      friction={1.5}
      rightThreshold={44}
      dragOffsetFromRightEdge={20}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current)
          registry.onWillOpen(rowKey, swipeableRef.current);
      }}
      onSwipeableClose={() => {
        if (swipeableRef.current)
          registry.onClose(rowKey, swipeableRef.current);
      }}
      renderRightActions={(_progress, _translation, methods) => (
        <Button
          testID={`swipe-delete-action-${rowKey}`}
          variant="destructive"
          className="h-full min-w-24 rounded-none"
          accessibilityLabel={`Delete ${label}`}
          accessibilityHint="Opens a confirmation before making changes"
          onPress={() => {
            methods.close();
            onRequestDelete();
          }}
          style={{ backgroundColor: theme.danger }}
        >
          <ButtonIcon as={Trash2} style={{ color: theme.raw.white }} />
          <ButtonText style={{ color: theme.raw.white }}>Delete</ButtonText>
        </Button>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
