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

import type { NetworkDropZone } from "./network-device-drop";
import {
  NetworkDeviceRow,
  type NetworkDeviceRowDragCallbacks,
} from "./network-device-row";

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
  dragEnabled: boolean;
  activeDragDeviceKey?: string;
  interactionsDisabled: boolean;
  dragCallbacks: NetworkDeviceRowDragCallbacks;
  hoveredNetworkId?: string;
  onRegisterDropZone?(networkId: string, measure: () => void): () => void;
  onDropZoneChange?(zone: NetworkDropZone): void;
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
  dragEnabled,
  activeDragDeviceKey,
  interactionsDisabled,
  dragCallbacks,
  hoveredNetworkId,
  onRegisterDropZone,
  onDropZoneChange,
}: NetworkDeviceSectionProps) {
  const theme = useEight2FiveTheme();
  const headerRef = React.useRef<React.ComponentRef<typeof HStack>>(null);
  const title = section.network
    ? getNetworkDisplayName(section.network)
    : "Unassigned";
  const pan = section.network ? formatPanId(section.network.panId) : undefined;
  const count = `${section.devices.length} ${
    section.devices.length === 1 ? "device" : "devices"
  }`;
  const networkId = section.network?.id;
  const measureDropZone = React.useCallback(() => {
    if (!networkId || !onDropZoneChange) return;
    headerRef.current?.measureInWindow((x, y, width, height) => {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      )
        return;
      onDropZoneChange({
        networkId,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
      });
    });
  }, [networkId, onDropZoneChange]);

  React.useEffect(() => {
    if (!networkId || !onRegisterDropZone) return;
    return onRegisterDropZone(networkId, measureDropZone);
  }, [measureDropZone, networkId, onRegisterDropZone]);

  React.useEffect(() => {
    if (!networkId) return;
    const frame = requestAnimationFrame(measureDropZone);
    return () => cancelAnimationFrame(frame);
  }, [expanded, measureDropZone, networkId, section.devices.length]);

  return (
    <Accordion
      type="multiple"
      value={expanded ? [section.key] : []}
      onValueChange={(values) => {
        if (!interactionsDisabled)
          onExpandedChange(values.includes(section.key));
      }}
      isCollapsible
    >
      <AccordionItem value={section.key}>
        <AccordionHeader className="m-0 py-0">
          <HStack
            ref={headerRef}
            testID={networkId ? `network-drop-zone-${networkId}` : undefined}
            className="w-full items-center"
            onLayout={networkId ? measureDropZone : undefined}
            style={{
              paddingVertical: eight2FiveSpacing.sm,
              backgroundColor:
                hoveredNetworkId === networkId ? theme.accentSoft : undefined,
            }}
          >
            <AccordionTrigger
              testID={`section-toggle-${section.key}`}
              className="min-h-11 flex-1"
              disabled={interactionsDisabled}
              accessibilityLabel={`${title} section, ${
                pan ? `PAN ${pan}, ` : ""
              }${count}`}
              accessibilityHint={
                expanded ? "Collapse section" : "Expand section"
              }
              accessibilityState={{ expanded, disabled: interactionsDisabled }}
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
                isDisabled={interactionsDisabled}
                accessibilityLabel={`Edit ${title}`}
                accessibilityHint="Opens saved network settings"
                accessibilityState={{ disabled: interactionsDisabled }}
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
              interactionsDisabled={interactionsDisabled}
              dragCallbacks={
                dragEnabled &&
                (activeDragDeviceKey === undefined ||
                  activeDragDeviceKey === device.key) &&
                section.type === "unassigned" &&
                device.available &&
                device.discovery?.compatibility !== "malformed"
                  ? dragCallbacks
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
