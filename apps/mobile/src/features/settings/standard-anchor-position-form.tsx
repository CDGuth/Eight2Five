import { ChevronDown } from "lucide-react-native";
import type {
  AnchorPositionReference,
  AnchorPositionUnit,
  StandardAnchorPositionDraft,
} from "@eight2five/mobile/field";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@eight2five/ui/components/form-control";
import { Input, InputField } from "@eight2five/ui/components/input";
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
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  ANCHOR_REFERENCE_CHOICES,
  ANCHOR_UNIT_CHOICES,
} from "./anchor-editor-form";

export function StandardAnchorPositionForm({
  draft,
  errors,
  disabled,
  onChange,
  onReferenceChange,
  onUnitChange,
}: {
  readonly draft: StandardAnchorPositionDraft;
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled: boolean;
  readonly onChange: (draft: StandardAnchorPositionDraft) => void;
  readonly onReferenceChange: (reference: AnchorPositionReference) => void;
  readonly onUnitChange: (unit: AnchorPositionUnit) => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      <AnchorSelect
        label="Reference point"
        value={draft.reference}
        choices={ANCHOR_REFERENCE_CHOICES}
        disabled={disabled}
        onChange={onReferenceChange}
      />
      <AnchorSelect
        label="Units"
        value={draft.unit}
        choices={ANCHOR_UNIT_CHOICES}
        disabled={disabled}
        onChange={onUnitChange}
      />
      <AnchorNumberInput
        label="Side-to-side offset"
        value={draft.sideToSideOffset}
        error={errors.sideToSideOffset}
        disabled={disabled}
        onChange={(sideToSideOffset) =>
          onChange({ ...draft, sideToSideOffset })
        }
      />
      <Text size="sm">
        Negative side-to-side: toward Side 1{"\n"}Positive side-to-side: toward
        Side 2
      </Text>
      <AnchorNumberInput
        label="Front-to-back offset"
        value={draft.frontToBackOffset}
        error={errors.frontToBackOffset}
        disabled={disabled}
        onChange={(frontToBackOffset) =>
          onChange({ ...draft, frontToBackOffset })
        }
      />
      <Text size="sm">
        Negative front-to-back: toward front sideline{"\n"}Positive
        front-to-back: toward back sideline
      </Text>
      <AnchorNumberInput
        label="Height"
        value={draft.height}
        error={errors.height}
        disabled={disabled}
        onChange={(height) => onChange({ ...draft, height })}
      />
      {errors.position ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {errors.position}
        </Text>
      ) : null}
    </VStack>
  );
}

export function AnchorNumberInput({
  label,
  value,
  error,
  helper,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly error?: string;
  readonly helper?: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Input isDisabled={disabled}>
        <InputField
          value={value}
          editable={!disabled}
          inputMode="decimal"
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          onChangeText={onChange}
        />
      </Input>
      {helper ? (
        <FormControlHelper>
          <FormControlHelperText>{helper}</FormControlHelperText>
        </FormControlHelper>
      ) : null}
      {error ? (
        <FormControlError accessibilityRole="alert">
          <FormControlErrorText>{error}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}

function AnchorSelect<Value extends string>({
  label,
  value,
  choices,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: Value;
  readonly choices: readonly {
    readonly label: string;
    readonly value: Value;
  }[];
  readonly disabled: boolean;
  readonly onChange: (value: Value) => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select
        selectedValue={value}
        isDisabled={disabled}
        onValueChange={(next) => onChange(next as Value)}
      >
        <SelectTrigger
          accessibilityLabel={label}
          size="lg"
          style={{ borderColor: theme.border, backgroundColor: theme.surface }}
        >
          <SelectInput style={{ color: theme.text }} />
          <SelectIcon as={ChevronDown} style={{ color: theme.icon }} />
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
    </FormControl>
  );
}
