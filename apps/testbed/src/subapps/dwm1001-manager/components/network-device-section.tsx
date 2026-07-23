import React from "react";
import { View } from "react-native";
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
import { Card } from "@eight2five/ui/components/card";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { ChevronDown, Pencil } from "lucide-react-native";

import type { NetworkDropZone } from "./network-device-drop";
import {
  MANAGER_CARD_CONTENT_INSET,
  MANAGER_CHILD_RAIL_WIDTH,
} from "./manager-layout";
import {
  ManagerSwipeToDelete,
  type ManagerSwipeRegistryCallbacks,
} from "./manager-swipe-to-delete";
import { SettingInfoCard } from "./setting-help";
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
  onRequestDeviceDelete?(
    device: NetworkDeviceSectionModel["devices"][number],
  ): void;
  swipeRegistry: ManagerSwipeRegistryCallbacks;
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
  onRequestDeviceDelete,
  swipeRegistry,
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
    : "Unassigned Devices";
  const pan = section.network ? formatPanId(section.network.panId) : undefined;
  const count = `${section.devices.length} ${
    section.devices.length === 1 ? "device" : "devices"
  }`;
  const legacyReservedPan = section.network?.panId === 0;
  const resolvedEmptyMessage =
    emptyMessage ??
    (section.network && section.devices.length === 0
      ? "No devices match this network."
      : undefined);
  const networkId = section.network?.id;
  const dropTargetNetworkId = legacyReservedPan ? undefined : networkId;
  const measureDropZone = React.useCallback(() => {
    if (!dropTargetNetworkId || !onDropZoneChange) return;
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
        networkId: dropTargetNetworkId,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
      });
    });
  }, [dropTargetNetworkId, onDropZoneChange]);

  React.useEffect(() => {
    if (!dropTargetNetworkId || !onRegisterDropZone) return;
    return onRegisterDropZone(dropTargetNetworkId, measureDropZone);
  }, [dropTargetNetworkId, measureDropZone, onRegisterDropZone]);

  React.useEffect(() => {
    if (!dropTargetNetworkId) return;
    const frame = requestAnimationFrame(measureDropZone);
    return () => cancelAnimationFrame(frame);
  }, [dropTargetNetworkId, expanded, measureDropZone, section.devices.length]);

  const accordion = (
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
            testID={
              dropTargetNetworkId
                ? `network-drop-zone-${dropTargetNetworkId}`
                : undefined
            }
            className="w-full items-center"
            onLayout={dropTargetNetworkId ? measureDropZone : undefined}
            style={{
              paddingVertical: eight2FiveSpacing.sm,
              paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
              backgroundColor:
                dropTargetNetworkId && hoveredNetworkId === dropTargetNetworkId
                  ? theme.accentSoft
                  : undefined,
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
                {legacyReservedPan ? (
                  <Text selectable size="sm" style={{ color: theme.danger }}>
                    PAN 0 is reserved · repair or delete this profile
                  </Text>
                ) : null}
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
        <AccordionContent className="p-0">
          <VStack
            style={{
              paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
            }}
          >
            {legacyReservedPan ? (
              <SettingInfoCard tone="error">
                This legacy profile uses reserved PAN 0 and cannot accept device
                assignments. Change it to PAN 1–65535 or delete it.
              </SettingInfoCard>
            ) : null}
            {section.devices.map((device, index) => {
              const row = (
                <NetworkDeviceRow
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
                      ? async () =>
                          await onRefreshDevice(device.savedDevice!.id)
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
              );
              const swipeable =
                device.savedDevice && onRequestDeviceDelete ? (
                  <ManagerSwipeToDelete
                    rowKey={device.key}
                    label={device.displayName}
                    enabled={!interactionsDisabled}
                    registry={swipeRegistry}
                    onRequestDelete={() => onRequestDeviceDelete(device)}
                  >
                    {row}
                  </ManagerSwipeToDelete>
                ) : (
                  row
                );
              return section.network ? (
                <HStack key={device.key} className="items-stretch">
                  <ChildRail isLast={index === section.devices.length - 1} />
                  <VStack className="flex-1">{swipeable}</VStack>
                </HStack>
              ) : (
                <React.Fragment key={device.key}>{swipeable}</React.Fragment>
              );
            })}
            {section.devices.length === 0 && resolvedEmptyMessage ? (
              <Text
                testID="network-devices-empty"
                selectable
                style={{
                  color: theme.textMuted,
                  paddingVertical: eight2FiveSpacing.md,
                  paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
                }}
              >
                {resolvedEmptyMessage}
              </Text>
            ) : null}
          </VStack>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  if (!section.network) return accordion;
  return (
    <Card
      testID={`network-card-${section.network.id}`}
      className="p-0"
      style={{
        borderWidth: 0,
        borderRadius: eight2FiveRadii.md,
        backgroundColor: theme.surfaceRaised,
        overflow: "hidden",
        marginBottom: eight2FiveSpacing.md,
      }}
    >
      {accordion}
    </Card>
  );
}

function ChildRail({ isLast }: { isLast: boolean }) {
  const theme = useEight2FiveTheme();
  const left = eight2FiveSpacing.sm;
  return (
    <View
      testID="network-device-child-rail"
      style={{ width: MANAGER_CHILD_RAIL_WIDTH, position: "relative" }}
    >
      <View
        style={{
          position: "absolute",
          left,
          top: 0,
          bottom: isLast ? "50%" : 0,
          width: 1,
          backgroundColor: theme.border,
        }}
      />
      <View
        style={{
          position: "absolute",
          left,
          top: "50%",
          width: MANAGER_CHILD_RAIL_WIDTH - left,
          height: 1,
          backgroundColor: theme.border,
        }}
      />
    </View>
  );
}
