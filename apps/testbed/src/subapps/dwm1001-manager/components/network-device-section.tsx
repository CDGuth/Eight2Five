import React from "react";
import type {
  DeviceConfigurationSnapshot,
  NetworkDeviceSection as NetworkDeviceSectionModel,
  PansInspectionResult,
} from "@eight2five/mobile/pans-manager";
import {
  formatPanId,
  getNetworkDisplayName,
} from "@eight2five/mobile/pans-manager";
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIcon,
  AccordionItem,
  AccordionTrigger,
} from "@eight2five/ui/components/accordion";
import { Button, ButtonIcon } from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { ChevronDown, Pencil } from "lucide-react-native";

import { NetworkDeviceRow } from "./network-device-row";

export interface NetworkDeviceSectionProps {
  section: NetworkDeviceSectionModel;
  expanded: boolean;
  onExpandedChange(expanded: boolean): void;
  expandedDeviceKeys: ReadonlySet<string>;
  onDeviceExpandedChange(deviceKey: string, expanded: boolean): void;
  snapshots: Readonly<Record<string, DeviceConfigurationSnapshot>>;
  emptyMessage?: string;
  onEditNetwork?(networkId: string): void;
  onOpenDeviceSettings(
    device: NetworkDeviceSectionModel["devices"][number],
  ): Promise<void>;
  onRefreshDevice?(deviceId: string): Promise<PansInspectionResult>;
}

export function NetworkDeviceSection({
  section,
  expanded,
  onExpandedChange,
  expandedDeviceKeys,
  onDeviceExpandedChange,
  snapshots,
  emptyMessage,
  onEditNetwork,
  onOpenDeviceSettings,
  onRefreshDevice,
}: NetworkDeviceSectionProps) {
  const theme = useEight2FiveTheme();
  const title = section.network
    ? getNetworkDisplayName(section.network)
    : "Unassigned";
  const pan = section.network ? formatPanId(section.network.panId) : undefined;
  const count = `${section.devices.length} ${
    section.devices.length === 1 ? "device" : "devices"
  }`;

  return (
    <Accordion
      type="multiple"
      value={expanded ? [section.key] : []}
      onValueChange={(values) => onExpandedChange(values.includes(section.key))}
      isCollapsible
    >
      <AccordionItem value={section.key}>
        <AccordionHeader className="m-0 py-0">
          <HStack
            className="w-full items-center"
            style={{ paddingVertical: eight2FiveSpacing.sm }}
          >
            <AccordionTrigger
              testID={`section-toggle-${section.key}`}
              className="min-h-11 flex-1"
              accessibilityLabel={`${title} section, ${
                pan ? `PAN ${pan}, ` : ""
              }${count}`}
              accessibilityHint={
                expanded ? "Collapse section" : "Expand section"
              }
              accessibilityState={{ expanded }}
            >
              <VStack className="flex-1" style={{ gap: eight2FiveSpacing.xs }}>
                <Text
                  style={{
                    color: theme.text,
                    fontFamily: eight2FiveFonts.styleSemibold,
                  }}
                >
                  {title}
                </Text>
                <Text selectable size="sm" style={{ color: theme.textMuted }}>
                  {pan ? `PAN ${pan} · ` : ""}
                  {count}
                </Text>
              </VStack>
              <AccordionIcon
                as={ChevronDown}
                style={{ color: theme.icon }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </AccordionTrigger>
            {section.network && onEditNetwork ? (
              <Button
                testID={`edit-network-${section.network.id}`}
                size="icon"
                variant="ghost"
                accessibilityLabel={`Edit ${title}`}
                onPress={() => onEditNetwork(section.network!.id)}
              >
                <ButtonIcon as={Pencil} style={{ color: theme.icon }} />
              </Button>
            ) : null}
          </HStack>
        </AccordionHeader>
        <Divider style={{ backgroundColor: theme.border }} />
        <AccordionContent className="pb-0">
          {section.devices.map((device) => (
            <NetworkDeviceRow
              key={device.key}
              device={device}
              network={section.network}
              snapshot={
                device.savedDevice
                  ? snapshots[device.savedDevice.id]
                  : undefined
              }
              expanded={expandedDeviceKeys.has(device.key)}
              onExpandedChange={(next) =>
                onDeviceExpandedChange(device.key, next)
              }
              onOpenSettings={() => onOpenDeviceSettings(device)}
              onRefresh={
                device.savedDevice && device.available && onRefreshDevice
                  ? async () => await onRefreshDevice(device.savedDevice!.id)
                  : undefined
              }
            />
          ))}
          {section.devices.length === 0 && emptyMessage ? (
            <Text
              testID="network-devices-empty"
              selectable
              style={{
                color: theme.textMuted,
                paddingVertical: eight2FiveSpacing.md,
              }}
            >
              {emptyMessage}
            </Text>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
