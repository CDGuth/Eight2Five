import React from "react";
import type { DiscoveredDeviceSnapshot } from "@eight2five/mobile/pans-manager";
import { Badge, BadgeText } from "@eight2five/ui/badge";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Box } from "@eight2five/ui/box";
import { HStack } from "@eight2five/ui/hstack";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { formatRelativeTime } from "../manager-utils";

export function DiscoveryDeviceRow({
  device,
  selected,
  saved,
  onToggle,
  onOpen,
  onInspect,
}: {
  device: DiscoveredDeviceSnapshot;
  selected: boolean;
  saved: boolean;
  onToggle(): void;
  onOpen(): void;
  onInspect(): void;
}) {
  const presence = device.presence;
  return (
    <VStack
      testID={`discovery-device-${device.transportDeviceId}`}
      className="gap-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      <HStack className="items-start justify-between gap-3">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={onToggle}
          className="min-h-11 flex-1 flex-row items-start gap-2"
        >
          <Box
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
              selected
                ? "border-primary bg-primary"
                : "border-gray-400 bg-white"
            }`}
          >
            <Text className={selected ? "text-white" : "text-transparent"}>
              ✓
            </Text>
          </Box>
          <VStack className="shrink">
            <Text className="font-semibold text-black">
              {device.name || device.transportDeviceId || "Malformed device"}
            </Text>
            <Text selectable className="text-xs text-gray-600">
              {device.macAddress ?? device.transportDeviceId}
            </Text>
          </VStack>
        </Pressable>
        <Badge
          variant={
            device.compatibility === "compatible" ? "default" : "outline"
          }
        >
          <BadgeText>{device.compatibility}</BadgeText>
        </Badge>
      </HStack>
      <HStack className="flex-wrap gap-2">
        <Badge variant="secondary">
          <BadgeText>{presence?.role ?? "unknown role"}</BadgeText>
        </Badge>
        <Badge variant="outline">
          <BadgeText>{presence?.uwbMode ?? "UWB unknown"}</BadgeText>
        </Badge>
        {presence?.initiator ? (
          <Badge variant="outline">
            <BadgeText>initiator</BadgeText>
          </Badge>
        ) : null}
        {presence?.bridge ? (
          <Badge variant="outline">
            <BadgeText>bridge</BadgeText>
          </Badge>
        ) : null}
        {saved ? (
          <Badge variant="secondary">
            <BadgeText>saved nearby</BadgeText>
          </Badge>
        ) : null}
        {device.stale ? (
          <Badge variant="destructive">
            <BadgeText>stale</BadgeText>
          </Badge>
        ) : null}
      </HStack>
      <Text selectable className="text-sm text-gray-700">
        RSSI {device.rssi} dBm · seen {formatRelativeTime(device.lastSeenAt)}
        {presence
          ? ` · mode 0x${presence.rawOperationModeByte
              .toString(16)
              .padStart(2, "0")}`
          : ""}
      </Text>
      {device.reason ? (
        <Text selectable className="text-sm text-amber-700">
          {device.reason}
        </Text>
      ) : null}
      <HStack className="flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onPress={onOpen}>
          <ButtonText>{saved ? "Open summary" : "Save & open"}</ButtonText>
        </Button>
        <Button variant="ghost" className="min-h-11" onPress={onInspect}>
          <ButtonText>Inspect now</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
