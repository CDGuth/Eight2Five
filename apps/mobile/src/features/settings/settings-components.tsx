import React from "react";
import { Host, Picker } from "@expo/ui";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Card } from "@eight2five/ui/components/card";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Switch } from "@eight2five/ui/components/switch";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

export function SettingsScreenContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{
        gap: eight2FiveSpacing.lg,
        padding: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.xxl,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.sm }}>
      <Heading
        size="sm"
        style={{
          color: theme.textMuted,
          fontFamily: eight2FiveFonts.styleSemibold,
          paddingHorizontal: eight2FiveSpacing.xs,
        }}
      >
        {title}
      </Heading>
      <Card
        className="p-0"
        style={{
          overflow: "hidden",
          borderWidth: 0,
          borderRadius: eight2FiveRadii.md,
          backgroundColor: theme.surfaceRaised,
        }}
      >
        {children}
      </Card>
    </VStack>
  );
}

interface SettingsRowContentProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  accessory?: React.ReactNode;
  danger?: boolean;
}

function SettingsRowContent({
  icon,
  title,
  description,
  accessory,
  danger = false,
}: SettingsRowContentProps) {
  const theme = useEight2FiveTheme();
  const color = danger ? theme.danger : theme.text;
  return (
    <HStack
      className="min-h-16 items-center"
      style={{ gap: 12, padding: eight2FiveSpacing.md }}
    >
      <Icon as={icon} size="lg" style={{ color }} />
      <VStack className="flex-1" style={{ gap: 2 }}>
        <Text style={{ color, fontFamily: eight2FiveFonts.styleSemibold }}>
          {title}
        </Text>
        {description ? (
          <Text size="sm" style={{ color: theme.textMuted }}>
            {description}
          </Text>
        ) : null}
      </VStack>
      {accessory}
    </HStack>
  );
}

export function SettingsNavigationRow({
  icon,
  title,
  description,
  onPress,
  testID,
}: SettingsRowContentProps & { onPress(): void; testID?: string }) {
  const theme = useEight2FiveTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <SettingsRowContent
        icon={icon}
        title={title}
        description={description}
        accessory={
          <Icon
            as={ChevronRight}
            size="md"
            style={{ color: theme.textMuted }}
          />
        }
      />
    </Pressable>
  );
}

export function SettingsValueRow({
  icon,
  title,
  description,
  value,
}: SettingsRowContentProps & { value: string }) {
  const theme = useEight2FiveTheme();
  return (
    <SettingsRowContent
      icon={icon}
      title={title}
      description={description}
      accessory={
        <Text size="sm" style={{ color: theme.textMuted }}>
          {value}
        </Text>
      }
    />
  );
}

export function SettingsSwitchRow({
  icon,
  title,
  description,
  value,
  onChange,
  disabled,
  testID,
}: SettingsRowContentProps & {
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <SettingsRowContent
      icon={icon}
      title={title}
      description={description}
      accessory={
        <Switch
          testID={testID}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ false: theme.surfaceStrong, true: theme.accent }}
        />
      }
    />
  );
}

export interface SettingsSelectChoice<T extends string> {
  readonly label: string;
  readonly value: T;
}

export function SettingsSelectRow<T extends string>({
  icon,
  title,
  description,
  value,
  choices,
  onChange,
  disabled,
  testID,
}: SettingsRowContentProps & {
  value: T;
  choices: readonly SettingsSelectChoice<T>[];
  onChange(value: T): void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useEight2FiveTheme();
  const themeName = useEight2FiveThemeName();
  return (
    <VStack>
      <SettingsRowContent icon={icon} title={title} description={description} />
      <Host
        testID={testID}
        accessibilityLabel={title}
        colorScheme={themeName}
        seedColor={theme.accent}
        matchContents={{ vertical: true }}
        style={{
          alignSelf: "stretch",
          minHeight: 48,
          marginHorizontal: eight2FiveSpacing.md,
          marginBottom: eight2FiveSpacing.md,
        }}
      >
        <Picker<T>
          selectedValue={value}
          onValueChange={onChange}
          enabled={!disabled}
          appearance="menu"
          testID={testID ? `${testID}-picker` : undefined}
        >
          {choices.map((choice) => (
            <Picker.Item
              key={choice.value}
              label={choice.label}
              value={choice.value}
            />
          ))}
        </Picker>
      </Host>
    </VStack>
  );
}

export function SettingsMessage({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Card
      accessibilityRole="alert"
      style={{
        borderWidth: 0,
        borderRadius: eight2FiveRadii.sm,
        backgroundColor: tone === "error" ? theme.dangerSoft : theme.accentSoft,
        padding: 12,
      }}
    >
      <Text style={{ color: tone === "error" ? theme.danger : theme.text }}>
        {children}
      </Text>
    </Card>
  );
}

export { SettingsRowContent };
