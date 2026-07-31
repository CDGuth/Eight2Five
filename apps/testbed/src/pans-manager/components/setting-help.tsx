import React from "react";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { Info } from "lucide-react-native";

export function SettingHelp({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      accessible
      accessibilityLabel={`${title}. ${String(children)}`}
      style={{ gap: eight2FiveSpacing.sm }}
    >
      <Icon as={Info} size="sm" style={{ color: theme.textMuted }} />
      <VStack className="flex-1" style={{ gap: two }}>
        <Text
          size="sm"
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.utilitySemibold,
          }}
        >
          {title}
        </Text>
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          {children}
        </Text>
      </VStack>
    </HStack>
  );
}

export function SettingInfoCard({
  children,
  tone = "info",
  testID,
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "error";
  testID?: string;
}) {
  const theme = useEight2FiveTheme();
  const color = tone === "error" ? theme.danger : theme.warning;
  return (
    <VStack
      testID={testID}
      style={{
        gap: eight2FiveSpacing.sm,
        padding: eight2FiveSpacing.md,
        borderRadius: eight2FiveRadii.sm,
        backgroundColor:
          tone === "error"
            ? theme.dangerSoft
            : tone === "warning"
              ? theme.warningSoft
              : theme.accentSoft,
      }}
    >
      <Text
        selectable
        size="sm"
        style={{ color: tone === "info" ? theme.text : color }}
      >
        {children}
      </Text>
    </VStack>
  );
}

const two = 2;
