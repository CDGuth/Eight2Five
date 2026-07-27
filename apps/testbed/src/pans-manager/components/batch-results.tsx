import React from "react";
import type { PansBatchOperationItem } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

export function BatchResults({
  items,
  labels = {},
}: {
  items: PansBatchOperationItem[];
  labels?: Record<string, string>;
}) {
  const theme = useEight2FiveTheme();

  return (
    <VStack space="sm" testID="batch-results">
      {items.map((item) => (
        <Text
          key={item.deviceId}
          selectable
          size="sm"
          style={{ color: item.error ? theme.danger : theme.text }}
        >
          {labels[item.deviceId] ?? item.deviceId}: {item.status}
          {item.attempts > 1 ? ` (${item.attempts} attempts)` : ""}
          {item.error ? ` — ${item.error.message}` : ""}
        </Text>
      ))}
    </VStack>
  );
}
