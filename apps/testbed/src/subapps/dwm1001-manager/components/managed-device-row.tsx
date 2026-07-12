import React from "react";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";
import { Badge, BadgeText } from "@eight2five/ui/badge";
import { Button, ButtonText } from "@eight2five/ui/button";
import { HStack } from "@eight2five/ui/hstack";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { formatRelativeTime } from "../manager-utils";

export function ManagedDeviceRow({
  device,
  offline,
  onPress,
}: {
  device: ManagedDevice;
  offline?: boolean;
  onPress(): void;
}) {
  return (
    <Button
      variant="outline"
      className="min-h-20 h-auto justify-start p-4"
      onPress={onPress}
      testID={`managed-device-${device.id}`}
    >
      <VStack className="flex-1 items-start gap-2">
        <HStack className="w-full items-center justify-between gap-2">
          <ButtonText className="text-base">
            {device.nickname || device.label || device.transportDeviceId}
          </ButtonText>
          <Badge variant={offline ? "destructive" : "secondary"}>
            <BadgeText>
              {offline ? "offline" : (device.role ?? "pending")}
            </BadgeText>
          </Badge>
        </HStack>
        <Text selectable className="text-xs text-gray-600">
          {device.transportDeviceId} · seen{" "}
          {formatRelativeTime(device.lastSeenAt)}
        </Text>
        {device.notes?.includes("failed") ? (
          <Text selectable className="text-xs text-red-700">
            {device.notes}
          </Text>
        ) : null}
      </VStack>
    </Button>
  );
}
