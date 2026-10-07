import React from "react";
import {
  BluetoothConnected,
  ChevronRight,
  Network,
  Pencil,
  Radio,
} from "lucide-react-native";
import type {
  DisplayDevice,
  NetworkDeviceSection,
} from "@eight2five/mobile/pans-manager";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

export interface NetworkDeviceHierarchyProps {
  readonly sections: readonly NetworkDeviceSection[];
  readonly busy?: boolean;
  readonly onOpenNetwork?: (networkId: string) => void;
  readonly onOpenDevice: (device: DisplayDevice) => void;
  readonly onConnectTag?: (device: DisplayDevice) => void;
}

export function NetworkDeviceHierarchy({
  sections,
  busy = false,
  onOpenNetwork,
  onOpenDevice,
  onConnectTag,
}: NetworkDeviceHierarchyProps) {
  return (
    <VStack testID="mobile-network-device-hierarchy">
      {sections.map((section) => (
        <NetworkDeviceGroup
          key={section.key}
          section={section}
          busy={busy}
          onOpenNetwork={onOpenNetwork}
          onOpenDevice={onOpenDevice}
          onConnectTag={onConnectTag}
        />
      ))}
    </VStack>
  );
}

function NetworkDeviceGroup({
  section,
  busy,
  onOpenNetwork,
  onOpenDevice,
  onConnectTag,
}: {
  readonly section: NetworkDeviceSection;
  readonly busy: boolean;
  readonly onOpenNetwork?: (networkId: string) => void;
  readonly onOpenDevice: (device: DisplayDevice) => void;
  readonly onConnectTag?: (device: DisplayDevice) => void;
}) {
  const theme = useEight2FiveTheme();
  const title = section.network?.name ?? "Unassigned";
  return (
    <VStack
      testID={`network-device-section-${section.key}`}
      style={{ borderTopWidth: 1, borderTopColor: theme.border }}
    >
      <Pressable
        accessibilityRole={section.network ? "button" : undefined}
        accessibilityLabel={
          section.network ? `Edit network ${section.network.name}` : undefined
        }
        disabled={!section.network || busy || !onOpenNetwork}
        onPress={() => section.network && onOpenNetwork?.(section.network.id)}
      >
        <HStack
          className="items-center"
          style={{ gap: 10, padding: eight2FiveSpacing.md }}
        >
          <Icon as={Network} style={{ color: theme.accent }} />
          <VStack className="flex-1" style={{ gap: 2 }}>
            <Text style={{ color: theme.text }}>{title}</Text>
            <Text size="sm" style={{ color: theme.textMuted }}>
              {section.devices.length === 1
                ? "1 device"
                : `${section.devices.length} devices`}
            </Text>
          </VStack>
          {section.network && onOpenNetwork ? (
            <Icon as={Pencil} style={{ color: theme.accent }} />
          ) : null}
        </HStack>
      </Pressable>

      {section.devices.length === 0 ? (
        <Text
          size="sm"
          style={{
            color: theme.textMuted,
            paddingHorizontal: eight2FiveSpacing.md,
            paddingBottom: eight2FiveSpacing.md,
            paddingLeft: eight2FiveSpacing.xl,
          }}
        >
          No devices in this group.
        </Text>
      ) : (
        section.devices.map((device) => (
          <NetworkDeviceRow
            key={device.key}
            device={device}
            busy={busy}
            onOpen={() => onOpenDevice(device)}
            onConnect={
              onConnectTag && isAvailableTag(device)
                ? () => onConnectTag(device)
                : undefined
            }
          />
        ))
      )}
    </VStack>
  );
}

function NetworkDeviceRow({
  device,
  busy,
  onOpen,
  onConnect,
}: {
  readonly device: DisplayDevice;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onConnect?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const role =
    device.savedDevice?.lastKnownConfig?.role ??
    device.savedDevice?.role ??
    device.discovery?.presence?.role ??
    "unknown";
  return (
    <HStack
      className="items-center"
      style={{
        gap: 10,
        paddingHorizontal: eight2FiveSpacing.md,
        paddingVertical: eight2FiveSpacing.sm,
        paddingLeft: eight2FiveSpacing.xl,
      }}
    >
      <Icon
        as={role === "anchor" ? Radio : BluetoothConnected}
        style={{ color: device.available ? theme.accent : theme.textMuted }}
      />
      <Pressable
        className="flex-1"
        testID={`network-device-${device.key}`}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${device.displayName}`}
        disabled={busy}
        onPress={onOpen}
      >
        <VStack style={{ gap: 2 }}>
          <Text selectable style={{ color: theme.text }}>
            {device.displayName}
          </Text>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {role} · {device.available ? "nearby" : "cached"} ·{" "}
            {statusLabel(device)}
          </Text>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {device.canonicalIdentifier}
          </Text>
        </VStack>
      </Pressable>
      {onConnect ? (
        <Button
          size="sm"
          variant="outline"
          testID={`connect-network-device-${device.key}`}
          isDisabled={busy}
          onPress={onConnect}
        >
          <ButtonText>Connect</ButtonText>
        </Button>
      ) : (
        <Icon as={ChevronRight} style={{ color: theme.textMuted }} />
      )}
    </HStack>
  );
}

function isAvailableTag(device: DisplayDevice): boolean {
  return (
    device.available &&
    (device.discovery?.presence?.role === "tag" ||
      device.savedDevice?.lastKnownConfig?.role === "tag" ||
      device.savedDevice?.role === "tag")
  );
}

function statusLabel(device: DisplayDevice): string {
  switch (device.status) {
    case "assigned-matching":
      return "PAN verified";
    case "pan-conflict":
      return "PAN conflict";
    case "pan-unverified":
      return "PAN unverified";
    default:
      return "not assigned";
  }
}
