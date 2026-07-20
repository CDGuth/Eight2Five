import React from "react";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";
import { Badge, BadgeText } from "@eight2five/ui/components/badge";
import { Card } from "@eight2five/ui/components/card";
import { HStack } from "@eight2five/ui/components/hstack";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

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
  const theme = useEight2FiveTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`managed-device-${device.id}`}
    >
      <Card
        className="p-0"
        style={{
          borderWidth: 0,
          borderRadius: eight2FiveRadii.sm,
          backgroundColor: theme.surface,
          padding: 14,
        }}
      >
        <VStack style={{ gap: 6 }}>
          <HStack className="items-center justify-between" style={{ gap: 8 }}>
            <Text
              className="flex-1"
              style={{
                color: theme.text,
                fontFamily: eight2FiveFonts.styleSemibold,
              }}
            >
              {device.nickname || device.label || device.transportDeviceId}
            </Text>
            <Badge variant={offline ? "destructive" : "secondary"}>
              <BadgeText>
                {offline ? "offline" : (device.role ?? "unconfigured")}
              </BadgeText>
            </Badge>
          </HStack>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {device.transportDeviceId} · seen{" "}
            {formatRelativeTime(device.lastSeenAt)}
          </Text>
          {device.notes?.includes("failed") ? (
            <Text selectable size="sm" style={{ color: theme.danger }}>
              {device.notes}
            </Text>
          ) : null}
        </VStack>
      </Card>
    </Pressable>
  );
}
