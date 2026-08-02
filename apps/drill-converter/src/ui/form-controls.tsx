import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { colors, radius, spacing } from "./theme";

export function FormField({
  label,
  helper,
  value,
  onChangeText,
  multiline = false,
  placeholder,
  error,
  ...props
}: {
  readonly label: string;
  readonly helper?: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly multiline?: boolean;
  readonly placeholder?: string;
  readonly error?: string;
} & Omit<
  TextInputProps,
  "value" | "onChangeText" | "multiline" | "placeholder"
>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
        {label}
      </Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={{
          minHeight: multiline ? 96 : 44,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.borderStrong,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 8,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 15,
          ...(multiline ? { textAlignVertical: "top" as const } : {}),
        }}
        accessibilityLabel={label}
      />
      {helper ? (
        <Text
          selectable
          style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
        >
          {helper}
        </Text>
      ) : null}
      {error ? (
        <Text
          selectable
          accessibilityRole="alert"
          style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function ChoiceChips<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label?: string;
  readonly value: Value;
  readonly options: readonly {
    readonly value: Value;
    readonly label: string;
  }[];
  readonly onChange: (value: Value) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => ({
                minHeight: 40,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.borderStrong,
                borderRadius: 999,
                paddingHorizontal: 14,
                backgroundColor: selected
                  ? colors.accentSoft
                  : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
              })}
            >
              <Text
                style={{
                  color: selected ? colors.accentText : colors.text,
                  fontWeight: selected ? "700" : "500",
                  fontSize: 13,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  readonly title: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderWidth: 1,
          borderColor: value ? colors.accent : colors.borderStrong,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: value ? colors.accent : colors.surface,
        }}
      >
        {value ? (
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>
            ✓
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        boxShadow: "0 4px 18px rgba(15, 23, 42, 0.05)",
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Disclosure({
  title,
  description,
  initiallyOpen = false,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly initiallyOpen?: boolean;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(initiallyOpen);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          padding: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
            {title}
          </Text>
          {description ? (
            <Text
              selectable
              style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
            >
              {description}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>
          {open ? "−" : "+"}
        </Text>
      </Pressable>
      {open ? (
        <View
          style={{
            gap: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: spacing.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        paddingHorizontal: 16,
        backgroundColor: disabled
          ? "#aab8cf"
          : pressed
            ? "#315ea9"
            : colors.accent,
      })}
    >
      <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 42,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: danger ? "#f1aaa4" : colors.borderStrong,
        paddingHorizontal: 14,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          color: danger ? colors.danger : colors.text,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
