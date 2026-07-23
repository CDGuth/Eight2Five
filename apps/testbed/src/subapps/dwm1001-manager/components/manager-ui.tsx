import React from "react";
import { ChevronDown } from "lucide-react-native";
import { Alert, AlertText } from "@eight2five/ui/components/alert";
import {
  Button,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@eight2five/ui/components/form-control";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { Input, InputField } from "@eight2five/ui/components/input";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@eight2five/ui/components/select";
import { Spinner } from "@eight2five/ui/components/spinner";
import { Switch } from "@eight2five/ui/components/switch";
import { Text } from "@eight2five/ui/components/text";
import { Textarea, TextareaInput } from "@eight2five/ui/components/textarea";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import { MANAGER_CARD_CONTENT_INSET } from "./manager-layout";

export function ManagerScreen({ children }: { children: React.ReactNode }) {
  const theme = useEight2FiveTheme();
  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: MANAGER_CARD_CONTENT_INSET,
        gap: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.xxl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function SectionCard({
  title,
  description,
  children,
  testID,
  tone = "default",
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  testID?: string;
  tone?: "default" | "accent" | "quiet";
}) {
  const theme = useEight2FiveTheme();
  const backgroundColor =
    tone === "accent"
      ? theme.accentSoft
      : tone === "quiet"
        ? theme.surface
        : theme.surfaceRaised;

  return (
    <Card
      testID={testID}
      className="p-0"
      style={{
        backgroundColor,
        borderWidth: 0,
        borderRadius: eight2FiveRadii.md,
        padding: eight2FiveSpacing.md,
      }}
    >
      <VStack style={{ gap: eight2FiveSpacing.md }}>
        <VStack style={{ gap: four }}>
          <Heading size="md" style={{ color: theme.text }}>
            {title}
          </Heading>
          {description ? (
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {description}
            </Text>
          ) : null}
        </VStack>
        {children}
      </VStack>
    </Card>
  );
}

const four = 4;

export function StatePanel({
  state,
  message,
  onRetry,
}: {
  state: "loading" | "error" | "success" | "info";
  message: string;
  onRetry?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const palette = {
    error: { background: theme.dangerSoft, foreground: theme.danger },
    success: { background: theme.successSoft, foreground: theme.success },
    info: { background: theme.accentSoft, foreground: theme.accent },
    loading: { background: theme.surface, foreground: theme.accent },
  }[state];

  if (state === "loading") {
    return (
      <HStack
        className="min-h-11 items-center"
        style={{
          gap: eight2FiveSpacing.sm,
          borderRadius: eight2FiveRadii.sm,
          backgroundColor: palette.background,
          padding: 12,
        }}
      >
        <Spinner color={palette.foreground} />
        <Text selectable style={{ color: theme.text }}>
          {message}
        </Text>
      </HStack>
    );
  }

  return (
    <Alert
      variant={state === "error" ? "destructive" : "default"}
      style={{
        borderWidth: 0,
        borderRadius: eight2FiveRadii.sm,
        backgroundColor: palette.background,
        padding: 12,
      }}
    >
      <VStack className="flex-1" style={{ gap: eight2FiveSpacing.sm }}>
        <AlertText
          selectable
          style={{
            color: state === "error" ? palette.foreground : theme.text,
            fontFamily: eight2FiveFonts.utilityRegular,
          }}
        >
          {message}
        </AlertText>
        {onRetry ? (
          <ManagerButton label="Retry" variant="outline" onPress={onRetry} />
        ) : null}
      </VStack>
    </Alert>
  );
}

export function ManagerButton({
  label,
  loading,
  variant = "default",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  label: string;
  loading?: boolean;
}) {
  const theme = useEight2FiveTheme();
  const visual =
    variant === "destructive"
      ? { background: theme.danger, foreground: theme.raw.white }
      : variant === "outline"
        ? { background: theme.accentSoft, foreground: theme.accent }
        : variant === "secondary"
          ? { background: theme.surfaceStrong, foreground: theme.text }
          : variant === "ghost" || variant === "link"
            ? { background: "transparent", foreground: theme.accent }
            : { background: theme.accent, foreground: theme.raw.white };

  return (
    <Button
      {...props}
      variant={variant}
      isDisabled={props.isDisabled || loading}
      className={`min-h-12 rounded-xl px-5 ${className ?? ""}`}
      style={{
        backgroundColor: visual.background,
        borderWidth: 0,
      }}
    >
      {loading ? <ButtonSpinner color={visual.foreground} /> : null}
      <ButtonText style={{ color: visual.foreground }}>{label}</ButtonText>
    </Button>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  helper,
  error,
  multiline = false,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText(text: string): void;
  helper?: string;
  error?: string;
  multiline?: boolean;
} & Omit<React.ComponentProps<typeof InputField>, "value" | "onChangeText">) {
  const theme = useEight2FiveTheme();
  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormControlLabel>
        <FormControlLabelText
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.styleSemibold,
          }}
        >
          {label}
        </FormControlLabelText>
      </FormControlLabel>
      {multiline ? (
        <Textarea
          className="min-h-24"
          style={{
            borderWidth: 0,
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surface,
          }}
        >
          <TextareaInput
            value={value}
            onChangeText={onChangeText}
            style={{
              color: theme.text,
              fontFamily: eight2FiveFonts.utilityRegular,
            }}
            {...inputProps}
          />
        </Textarea>
      ) : (
        <Input
          className="min-h-12"
          style={{
            borderWidth: 0,
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surface,
          }}
        >
          <InputField
            value={value}
            onChangeText={onChangeText}
            style={{
              color: theme.text,
              fontFamily: eight2FiveFonts.utilityRegular,
            }}
            {...inputProps}
          />
        </Input>
      )}
      {helper ? (
        <FormControlHelper>
          <FormControlHelperText
            style={{
              color: theme.textMuted,
              fontFamily: eight2FiveFonts.utilityRegular,
            }}
          >
            {helper}
          </FormControlHelperText>
        </FormControlHelper>
      ) : null}
      {error ? (
        <FormControlError>
          <FormControlErrorText selectable style={{ color: theme.danger }}>
            {error}
          </FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}

export interface SelectChoice {
  label: string;
  value: string;
}

export function SelectField({
  label,
  value,
  choices,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  choices: SelectChoice[];
  onChange(value: string): void;
  helper?: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.styleSemibold,
          }}
        >
          {label}
        </FormControlLabelText>
      </FormControlLabel>
      <Select selectedValue={value} onValueChange={onChange}>
        <SelectTrigger
          size="lg"
          className="min-h-12"
          style={{
            borderWidth: 0,
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surface,
          }}
        >
          <SelectInput
            value={
              choices.find((choice) => choice.value === value)?.label ?? value
            }
            className="flex-1"
            style={{
              color: theme.text,
              fontFamily: eight2FiveFonts.utilityRegular,
            }}
          />
          <SelectIcon
            as={ChevronDown}
            className="mr-3"
            style={{ color: theme.icon }}
          />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent style={{ backgroundColor: theme.surfaceRaised }}>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            {choices.map((choice) => (
              <SelectItem
                key={choice.value}
                label={choice.label}
                value={choice.value}
              />
            ))}
          </SelectContent>
        </SelectPortal>
      </Select>
      {helper ? (
        <FormControlHelper>
          <FormControlHelperText style={{ color: theme.textMuted }}>
            {helper}
          </FormControlHelperText>
        </FormControlHelper>
      ) : null}
    </FormControl>
  );
}

export function SwitchField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="min-h-11 items-center justify-between"
      style={{ gap: 16 }}
    >
      <VStack className="flex-1" style={{ gap: 2 }}>
        <Text
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.styleSemibold,
          }}
        >
          {label}
        </Text>
        {description ? (
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {description}
          </Text>
        ) : null}
      </VStack>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: theme.surfaceStrong, true: theme.accent }}
      />
    </HStack>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack className="min-h-8 items-start justify-between" style={{ gap: 16 }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        className="shrink text-right"
        style={{
          color: theme.text,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </HStack>
  );
}
