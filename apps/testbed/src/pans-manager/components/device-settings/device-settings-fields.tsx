import React from "react";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { Input, InputField } from "@eight2five/ui/components/input";
import { Switch } from "@eight2five/ui/components/switch";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      <Heading size="md" style={{ color: theme.text }}>
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

export function TextField({
  label,
  compact,
  disabled,
  helper,
  error,
  ...props
}: Omit<React.ComponentProps<typeof InputField>, "disabled"> & {
  label: string;
  compact?: boolean;
  disabled?: boolean;
  helper?: string;
  error?: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack className={compact ? "flex-1" : undefined} style={{ gap: 4 }}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        style={{
          minHeight: 44,
          borderColor: theme.border,
          borderRadius: eight2FiveRadii.sm,
          backgroundColor: theme.surface,
        }}
        isDisabled={disabled}
        isInvalid={Boolean(error)}
      >
        <InputField
          {...props}
          editable={!disabled && props.editable !== false}
          style={[{ color: theme.text }, props.style]}
        />
      </Input>
      {error ? (
        <Text
          selectable
          size="sm"
          accessibilityRole="alert"
          style={{ color: theme.danger }}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          {helper}
        </Text>
      ) : null}
    </VStack>
  );
}

export function OptionalSwitch({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="min-h-11 items-center justify-between"
      style={{ gap: 16 }}
    >
      <FieldLabel>{label}</FieldLabel>
      {value === undefined ? (
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          Unavailable
        </Text>
      ) : (
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ false: theme.surfaceStrong, true: theme.accent }}
        />
      )}
    </HStack>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const theme = useEight2FiveTheme();
  return (
    <Text
      style={{ color: theme.text, fontFamily: eight2FiveFonts.styleSemibold }}
    >
      {children}
    </Text>
  );
}

export function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack className="items-start justify-between" style={{ gap: 16 }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        className="shrink text-right"
        style={{ color: theme.text }}
      >
        {value}
      </Text>
    </HStack>
  );
}

export function cachedFieldLabel(
  label: string,
  source: "cached" | "actual",
  unavailableFields: string[],
  field: string,
): string {
  return source === "actual" && unavailableFields.includes(field)
    ? `${label} (cached; read unavailable)`
    : label;
}
