import React from "react";
import { View } from "react-native";
import type { NetworkDeviceSection as NetworkDeviceSectionModel } from "@eight2five/mobile/pans-manager";
import {
  formatPanId,
  getNetworkDisplayName,
  PANS_UNASSIGNED_PAN_ID,
} from "@eight2five/mobile/pans-manager";
import {
  Accordion,
  AccordionHeader,
  AccordionIcon,
  AccordionItem,
  AccordionTrigger,
} from "@eight2five/ui/components/accordion";
import { Button, ButtonIcon } from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
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

import {
  MANAGER_CARD_CONTENT_INSET,
  MANAGER_CHILD_RAIL_WIDTH,
} from "./manager-layout";
import { SettingInfoCard } from "./setting-help";

/**
 * A section header only. Device content is deliberately rendered by the
 * screen's virtualized list, rather than being mapped from this component.
 */
export interface NetworkDeviceSectionProps {
  section: NetworkDeviceSectionModel;
  expanded: boolean;
  onExpandedChange(expanded: boolean): void;
  onEditNetwork?(networkId: string): void;
}

export function NetworkDeviceSection({
  section,
  expanded,
  onExpandedChange,
  onEditNetwork,
}: NetworkDeviceSectionProps) {
  const theme = useEight2FiveTheme();
  const title = section.network
    ? getNetworkDisplayName(section.network)
    : "Unassigned Devices";
  const pan = section.network ? formatPanId(section.network.panId) : undefined;
  const count = `${section.devices.length} ${
    section.devices.length === 1 ? "device" : "devices"
  }`;
  const legacyUnassignedPan = section.network?.panId === PANS_UNASSIGNED_PAN_ID;

  const header = (
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
            style={{
              paddingVertical: eight2FiveSpacing.sm,
              paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
            }}
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
                {legacyUnassignedPan ? (
                  <Text selectable size="sm" style={{ color: theme.danger }}>
                    PAN 0 is the PANS default for unassigned devices · repair or
                    delete this profile
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
                accessibilityLabel={`Edit ${title}`}
                accessibilityHint="Opens saved network settings"
                onPress={() => onEditNetwork(section.network!.id)}
              >
                <ButtonIcon as={Pencil} style={{ color: theme.icon }} />
              </Button>
            ) : null}
          </HStack>
        </AccordionHeader>
      </AccordionItem>
    </Accordion>
  );

  if (!section.network) return header;
  return (
    <Card
      testID={`network-card-${section.network.id}`}
      className="p-0"
      style={{
        borderWidth: 0,
        borderRadius: eight2FiveRadii.md,
        backgroundColor: theme.surfaceRaised,
        overflow: "hidden",
      }}
    >
      {header}
    </Card>
  );
}

export const MemoizedNetworkDeviceSection = React.memo(NetworkDeviceSection);

export function NetworkDeviceChildRow({
  children,
  isLast,
}: {
  children: React.ReactNode;
  isLast: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="items-stretch"
      style={{
        paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
        backgroundColor: theme.surfaceRaised,
        marginBottom: isLast ? eight2FiveSpacing.md : 0,
        borderBottomLeftRadius: isLast ? eight2FiveRadii.md : 0,
        borderBottomRightRadius: isLast ? eight2FiveRadii.md : 0,
      }}
    >
      <ChildRail isLast={isLast} />
      <VStack className="flex-1">{children}</VStack>
    </HStack>
  );
}

export function LegacyNetworkInfoRow() {
  const theme = useEight2FiveTheme();
  return (
    <VStack
      style={{
        paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
        backgroundColor: theme.surfaceRaised,
      }}
    >
      <SettingInfoCard tone="error">
        This legacy profile uses PAN 0, the PANS default PAN ID used for
        unassigned devices. It cannot accept assignments. Change it to PAN
        1–65535 or delete it.
      </SettingInfoCard>
    </VStack>
  );
}

export function NetworkDeviceEmptyRow({
  message,
  networkChild = false,
}: {
  message: string;
  networkChild?: boolean;
}) {
  const theme = useEight2FiveTheme();
  const content = (
    <Text
      testID="network-devices-empty"
      selectable
      style={{
        color: theme.textMuted,
        paddingVertical: eight2FiveSpacing.md,
        paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
      }}
    >
      {message}
    </Text>
  );
  return networkChild ? (
    <NetworkDeviceChildRow isLast>{content}</NetworkDeviceChildRow>
  ) : (
    content
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
