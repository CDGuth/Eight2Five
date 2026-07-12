import React from "react";
import type { PansBatchOperationItem } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

export function BatchResults({
  items,
  labels = {},
}: {
  items: PansBatchOperationItem[];
  labels?: Record<string, string>;
}) {
  return (
    <VStack space="sm" testID="batch-results">
      {items.map((item) => (
        <Text key={item.deviceId} selectable className="text-sm text-black">
          {labels[item.deviceId] ?? item.deviceId}: {item.status}
          {item.attempts > 1 ? ` (${item.attempts} attempts)` : ""}
          {item.error ? ` — ${item.error.message}` : ""}
        </Text>
      ))}
    </VStack>
  );
}
