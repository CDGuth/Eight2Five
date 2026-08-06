import React from "react";
import { ArrowLeftRight, ArrowUpDown } from "lucide-react-native";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveFonts } from "@eight2five/ui/theme";

import type { CoordinateLines } from "./field-hud-state";

export function CoordinateLinesView({
  coordinate,
  color,
  mutedColor,
  fontSize = 14,
  lineHeight = 17,
  iconSize = 13,
}: {
  readonly coordinate: CoordinateLines | null;
  readonly color: string;
  readonly mutedColor: string;
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly iconSize?: number;
}) {
  if (!coordinate) {
    return (
      <Text
        style={{
          color,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontSize,
          lineHeight,
        }}
      >
        –
      </Text>
    );
  }

  return (
    <VStack className="flex-1" style={{ gap: 2 }}>
      <CoordinateLine
        icon={ArrowLeftRight}
        value={coordinate.side}
        color={color}
        iconColor={mutedColor}
        fontSize={fontSize}
        lineHeight={lineHeight}
        iconSize={iconSize}
      />
      <CoordinateLine
        icon={ArrowUpDown}
        value={coordinate.frontBack}
        color={color}
        iconColor={mutedColor}
        fontSize={fontSize}
        lineHeight={lineHeight}
        iconSize={iconSize}
      />
    </VStack>
  );
}

function CoordinateLine({
  icon,
  value,
  color,
  iconColor,
  fontSize,
  lineHeight,
  iconSize,
}: {
  readonly icon: React.ElementType;
  readonly value: string;
  readonly color: string;
  readonly iconColor: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly iconSize: number;
}) {
  return (
    <HStack className="items-start" style={{ gap: 4 }}>
      <Icon
        as={icon}
        size={iconSize}
        style={{
          color: iconColor,
          marginTop: Math.max(1, (lineHeight - iconSize) / 2),
        }}
      />
      <Text
        className="flex-1"
        style={{
          color,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontSize,
          lineHeight,
          flexShrink: 1,
        }}
      >
        {value}
      </Text>
    </HStack>
  );
}
