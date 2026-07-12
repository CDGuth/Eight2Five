import React from "react";
import { Alert, AlertText } from "@eight2five/ui/alert";
import { Button, ButtonSpinner, ButtonText } from "@eight2five/ui/button";
import { Card } from "@eight2five/ui/card";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@eight2five/ui/form-control";
import { Heading } from "@eight2five/ui/heading";
import { HStack } from "@eight2five/ui/hstack";
import { ChevronDownIcon } from "@eight2five/ui/icon";
import { Input, InputField } from "@eight2five/ui/input";
import { ScrollView } from "@eight2five/ui/scroll-view";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  SelectIcon,
} from "@eight2five/ui/select";
import { Spinner } from "@eight2five/ui/spinner";
import { Switch } from "@eight2five/ui/switch";
import { Text } from "@eight2five/ui/text";
import { Textarea, TextareaInput } from "@eight2five/ui/textarea";
import { VStack } from "@eight2five/ui/vstack";

export function ManagerScreen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
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
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Card
      testID={testID}
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <VStack space="md">
        <VStack space="xs">
          <Heading size="md" className="text-black">
            {title}
          </Heading>
          {description ? (
            <Text selectable className="text-sm text-gray-600">
              {description}
            </Text>
          ) : null}
        </VStack>
        {children}
      </VStack>
    </Card>
  );
}

export function StatePanel({
  state,
  message,
  onRetry,
}: {
  state: "loading" | "error" | "success" | "info";
  message: string;
  onRetry?: () => void;
}) {
  if (state === "loading") {
    return (
      <HStack className="min-h-11 items-center gap-3 rounded-lg border border-gray-200 p-3">
        <Spinner color="#3c6ec8" />
        <Text selectable className="text-gray-700">
          {message}
        </Text>
      </HStack>
    );
  }
  return (
    <Alert variant={state === "error" ? "destructive" : "default"}>
      <VStack className="flex-1 gap-2">
        <AlertText selectable>{message}</AlertText>
        {onRetry ? (
          <Button
            variant="outline"
            className="min-h-11 self-start"
            onPress={onRetry}
          >
            <ButtonText>Retry</ButtonText>
          </Button>
        ) : null}
      </VStack>
    </Alert>
  );
}

export function ManagerButton({
  label,
  loading,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  label: string;
  loading?: boolean;
}) {
  return (
    <Button
      {...props}
      isDisabled={props.isDisabled || loading}
      className={`min-h-11 ${props.className ?? ""}`}
    >
      {loading ? <ButtonSpinner /> : null}
      <ButtonText>{label}</ButtonText>
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
  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      {multiline ? (
        <Textarea className="min-h-24">
          <TextareaInput
            value={value}
            onChangeText={onChangeText}
            {...inputProps}
          />
        </Textarea>
      ) : (
        <Input className="min-h-11">
          <InputField
            value={value}
            onChangeText={onChangeText}
            {...inputProps}
          />
        </Input>
      )}
      {helper ? (
        <FormControlHelper>
          <FormControlHelperText>{helper}</FormControlHelperText>
        </FormControlHelper>
      ) : null}
      {error ? (
        <FormControlError>
          <FormControlErrorText selectable>{error}</FormControlErrorText>
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
  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select selectedValue={value} onValueChange={onChange}>
        <SelectTrigger size="lg" className="min-h-11">
          <SelectInput
            value={
              choices.find((choice) => choice.value === value)?.label ?? value
            }
            className="flex-1"
          />
          <SelectIcon as={ChevronDownIcon} className="mr-3" />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
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
          <FormControlHelperText>{helper}</FormControlHelperText>
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
  return (
    <HStack className="min-h-11 items-center justify-between gap-4">
      <VStack className="flex-1">
        <Text className="font-medium text-black">{label}</Text>
        {description ? (
          <Text selectable className="text-sm text-gray-600">
            {description}
          </Text>
        ) : null}
      </VStack>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: "#d1d5db", true: "#3c6ec8" }}
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
  return (
    <HStack className="min-h-8 items-start justify-between gap-4">
      <Text className="text-sm text-gray-600">{label}</Text>
      <Text
        selectable
        className="shrink text-right text-sm font-medium text-black"
      >
        {value}
      </Text>
    </HStack>
  );
}
