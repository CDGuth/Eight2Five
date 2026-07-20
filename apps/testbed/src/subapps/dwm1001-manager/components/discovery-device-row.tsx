import React from "react";
import type { DiscoveredDeviceSnapshot } from "@eight2five/mobile/pans-manager";
import { Badge, BadgeText } from "@eight2five/ui/components/badge";
import { Card } from "@eight2five/ui/components/card";
import { HStack } from "@eight2five/ui/components/hstack";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import { formatRelativeTime } from "../manager-utils";
import { ManagerButton } from "./manager-ui";

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
  const theme = useEight2FiveTheme();
  const presence = device.presence;

  return (
    <Card
      testID={`discovery-device-${device.transportDeviceId}`}
      className="p-0"
      style={{
        borderWidth: 0,
        borderRadius: eight2FiveRadii.md,
        backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised,
        padding: eight2FiveSpacing.md,
        boxShadow: `0 6px 18px ${theme.shadow}`,
      }}
    >
      <VStack style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={onToggle}
          className="min-h-11"
        >
          <HStack className="items-start justify-between" style={{ gap: 12 }}>
            <HStack className="flex-1 items-start" style={{ gap: 10 }}>
              <Text
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  lineHeight: 26,
                  textAlign: "center",
                  color: selected ? theme.raw.white : theme.accent,
                  backgroundColor: selected ? theme.accent : theme.surface,
                  fontFamily: eight2FiveFonts.styleBold,
                }}
              >
                {selected ? "✓" : ""}
              </Text>
              <VStack className="flex-1" style={{ gap: 2 }}>
                <Text
                  style={{
                    color: theme.text,
                    fontFamily: eight2FiveFonts.styleSemibold,
                  }}
                >
                  {device.name || device.transportDeviceId || "Unknown device"}
                </Text>
                <Text selectable size="sm" style={{ color: theme.textMuted }}>
                  {device.macAddress ?? device.transportDeviceId}
                </Text>
              </VStack>
            </HStack>
            <Badge
              variant={
                device.compatibility === "compatible" ? "secondary" : "outline"
              }
            >
              <BadgeText>{device.compatibility}</BadgeText>
            </Badge>
          </HStack>
        </Pressable>

        <HStack className="flex-wrap" style={{ gap: 6 }}>
          <Badge variant="secondary">
            <BadgeText>{presence?.role ?? "unconfigured"}</BadgeText>
          </Badge>
          <Badge variant="outline">
            <BadgeText>{presence?.uwbMode ?? "UWB unknown"}</BadgeText>
          </Badge>
          {presence?.initiator ? (
            <Badge variant="outline">
              <BadgeText>initiator</BadgeText>
            </Badge>
          ) : null}
          {saved ? (
            <Badge variant="secondary">
              <BadgeText>saved</BadgeText>
            </Badge>
          ) : null}
          {device.stale ? (
            <Badge variant="destructive">
              <BadgeText>stale</BadgeText>
            </Badge>
          ) : null}
        </HStack>

        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          RSSI {device.rssi} dBm · seen {formatRelativeTime(device.lastSeenAt)}
        </Text>
        {device.reason ? (
          <Text selectable size="sm" style={{ color: theme.warning }}>
            {device.reason}
          </Text>
        ) : null}
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
          <ManagerButton
            label={saved ? "Open" : "Save & open"}
            variant="outline"
            onPress={onOpen}
          />
          <ManagerButton label="Inspect" variant="ghost" onPress={onInspect} />
        </HStack>
      </VStack>
    </Card>
  );
}
