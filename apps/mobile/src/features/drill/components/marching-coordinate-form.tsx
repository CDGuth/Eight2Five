import React from "react";
import { ChevronDown } from "lucide-react-native";
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
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import {
  getFieldPreset,
  getGridReference,
  type FieldPresetId,
} from "@eight2five/drill-schema";
import { getDrillTerms, type DrillTerms } from "@eight2five/mobile/drill";

import {
  YARD_LINES,
  previewCoordinate,
  validatePageDraft,
  type MarchingCoordinateDraft,
} from "../page-form";

const SIDE_CHOICES = [
  { label: "Side 1", value: "1" },
  { label: "Side 2", value: "2" },
  { label: "No side (on 50)", value: "center" },
] as const;

const SIDE_RELATION_CHOICES = [
  { label: "On", value: "on" },
  { label: "Inside", value: "inside" },
  { label: "Outside", value: "outside" },
] as const;

function frontBackChoices(fieldPreset: FieldPresetId) {
  const hashPrefix = fieldHashPrefix(fieldPreset);
  return [
    { label: "Front Sideline", value: "front-sideline" },
    { label: `${hashPrefix} FH`, value: "front-hash" },
    { label: `${hashPrefix} BH`, value: "back-hash" },
    { label: "Back Sideline", value: "back-sideline" },
  ] as const;
}

function fieldHashPrefix(fieldPreset: FieldPresetId): string {
  switch (fieldPreset) {
    case "football-nfhs":
      return "HS";
    case "football-ncaa":
      return "NCAA";
    case "football-texas-uil":
      return "UIL";
    case "football-nfl":
      return "NFL";
  }
}

function frontBackHelper(fieldPreset: FieldPresetId): string {
  const field = getFieldPreset(fieldPreset);
  const frontHash = getGridReference(field, "front-hash")?.coordinateSteps;
  const backHash = getGridReference(field, "back-hash")?.coordinateSteps;
  if (frontHash === undefined || backHash === undefined) {
    return "Offsets use the active field's marching-grid references.";
  }
  return `This field uses front hash ${formatStepReference(frontHash)} and back hash ${formatStepReference(backHash)}.`;
}

function formatStepReference(value: number): string {
  return Number(value.toFixed(3)).toString();
}

const FRONT_BACK_RELATION_CHOICES = [
  { label: "On", value: "on" },
  { label: "In front of", value: "in-front-of" },
  { label: "Behind", value: "behind" },
] as const;

export function MarchingCoordinateForm({
  draft,
  fieldPreset = "football-nfhs",
  terms = getDrillTerms("sets"),
  showDetails = true,
  disabled,
  onChange,
}: {
  draft: MarchingCoordinateDraft;
  fieldPreset?: FieldPresetId;
  terms?: DrillTerms;
  showDetails?: boolean;
  disabled: boolean;
  onChange(draft: MarchingCoordinateDraft): void;
}) {
  const theme = useEight2FiveTheme();
  const validation = validatePageDraft(draft, fieldPreset);
  const preview = previewCoordinate(draft, fieldPreset);
  const frontBackReferenceChoices = frontBackChoices(fieldPreset);
  const setKindChoices = [
    { label: terms.singular, value: "set" },
    { label: "Subset", value: "subset" },
  ] as const;
  const update = <Key extends keyof MarchingCoordinateDraft>(
    key: Key,
    value: MarchingCoordinateDraft[Key],
  ) => onChange({ ...draft, [key]: value });

  return (
    <VStack style={{ gap: eight2FiveSpacing.lg }}>
      {showDetails ? (
        <FormSection title={`${terms.singular} details`}>
          <TextField
            label={`${terms.singular} number`}
            value={draft.setNumber}
            error={validation.errors.setNumber}
            disabled={disabled}
            numeric
            helper={`The printed ${terms.lowercaseSingular} number. Subsets share the number of their primary ${terms.lowercaseSingular}.`}
            onChangeText={(value) => update("setNumber", value)}
          />
          <SelectField
            label="Type"
            value={draft.setKind}
            choices={setKindChoices}
            disabled={disabled}
            onChange={(value) =>
              onChange({
                ...draft,
                setKind: value,
                ...(value === "set" ? { setSuffix: "" } : {}),
              })
            }
          />
          {draft.setKind === "subset" ? (
            <TextField
              label="Suffix"
              value={draft.setSuffix}
              error={validation.errors.setSuffix}
              disabled={disabled}
              helper="One capital letter (A) or a decimal suffix (.5)."
              onChangeText={(value) => update("setSuffix", value)}
            />
          ) : null}
          <TextField
            label="Counts from previous"
            value={draft.countsFromPrevious}
            error={validation.errors.countsFromPrevious}
            disabled={disabled}
            numeric
            helper={`Whole-number transition counts. The first ${terms.lowercaseSingular} is always 0.`}
            onChangeText={(value) => update("countsFromPrevious", value)}
          />
          <TextField
            label="Measure start"
            value={draft.measureStart}
            error={validation.errors.measureStart}
            disabled={disabled}
            numeric
            helper="Optional. Measures are performer-facing reference information."
            onChangeText={(value) => update("measureStart", value)}
          />
          <TextField
            label="Measure end"
            value={draft.measureEnd}
            error={validation.errors.measureEnd}
            disabled={disabled}
            numeric
            onChangeText={(value) => update("measureEnd", value)}
          />
        </FormSection>
      ) : null}

      <FormSection title="Side to side">
        <SelectField
          label="Side"
          value={draft.side}
          choices={SIDE_CHOICES}
          error={validation.errors.side}
          disabled={disabled}
          onChange={(value) => {
            if (value === "center") {
              onChange({
                ...draft,
                side: "center",
                yardLine: "50",
                sideRelation: "on",
                sideOffsetSteps: "0",
              });
            } else {
              update("side", value);
            }
          }}
        />
        <SelectField
          label="Yard line"
          value={draft.yardLine}
          choices={YARD_LINES.map((yardLine) => ({
            label: yardLine === 0 ? "Goal Line" : `${yardLine} yard line`,
            value: String(yardLine),
          }))}
          error={validation.errors.yardLine}
          disabled={disabled}
          onChange={(value) => {
            const leavingCenter = value !== "50" && draft.side === "center";
            const exactlyOnFifty =
              value === "50" && Number(draft.sideOffsetSteps) === 0;
            onChange({
              ...draft,
              yardLine: value,
              side: leavingCenter
                ? "1"
                : exactlyOnFifty
                  ? "center"
                  : draft.side,
              ...(exactlyOnFifty
                ? { sideRelation: "on", sideOffsetSteps: "0" }
                : {}),
            });
          }}
        />
        <SelectField
          label="Relation"
          value={draft.sideRelation}
          choices={SIDE_RELATION_CHOICES}
          disabled={disabled || draft.side === "center"}
          onChange={(value) =>
            onChange({
              ...draft,
              sideRelation: value,
              ...(value === "on" ? { sideOffsetSteps: "0" } : {}),
            })
          }
        />
        <TextField
          label="Step offset"
          value={draft.sideOffsetSteps}
          error={validation.errors.sideOffsetSteps}
          disabled={disabled || draft.sideRelation === "on"}
          numeric
          helper="Fractional step values are preserved without rounding."
          onChangeText={(value) =>
            onChange({
              ...draft,
              sideOffsetSteps: value,
              ...(Number(value) === 0 ? { sideRelation: "on" } : {}),
            })
          }
        />
      </FormSection>

      <FormSection title="Front to back">
        <SelectField
          label="Reference"
          value={draft.frontBackReference}
          choices={frontBackReferenceChoices}
          disabled={disabled}
          onChange={(value) => update("frontBackReference", value)}
        />
        <SelectField
          label="Relation"
          value={draft.frontBackRelation}
          choices={FRONT_BACK_RELATION_CHOICES}
          disabled={disabled}
          onChange={(value) =>
            onChange({
              ...draft,
              frontBackRelation: value,
              ...(value === "on" ? { frontBackOffsetSteps: "0" } : {}),
            })
          }
        />
        <TextField
          label="Step offset"
          value={draft.frontBackOffsetSteps}
          error={validation.errors.frontBackOffsetSteps}
          disabled={disabled || draft.frontBackRelation === "on"}
          numeric
          helper={frontBackHelper(fieldPreset)}
          onChangeText={(value) =>
            onChange({
              ...draft,
              frontBackOffsetSteps: value,
              ...(Number(value) === 0 ? { frontBackRelation: "on" } : {}),
            })
          }
        />
      </FormSection>

      <Card
        accessibilityLabel={
          preview
            ? `Coordinate preview. ${preview.side}. ${preview.frontBack}.`
            : "Coordinate preview unavailable until all coordinate fields are valid."
        }
        style={{
          gap: eight2FiveSpacing.xs,
          borderRadius: eight2FiveRadii.md,
          borderColor: validation.errors.coordinate
            ? theme.danger
            : theme.border,
          backgroundColor: theme.accentSoft,
        }}
      >
        <Heading size="sm" style={{ color: theme.text }}>
          Coordinate preview
        </Heading>
        {preview ? (
          <>
            <Text style={{ color: theme.text }}>{preview.side}</Text>
            <Text style={{ color: theme.text }}>{preview.frontBack}</Text>
          </>
        ) : (
          <Text style={{ color: theme.textMuted }}>
            Complete a valid coordinate to preview it.
          </Text>
        )}
        {validation.errors.coordinate ? (
          <Text accessibilityRole="alert" style={{ color: theme.danger }}>
            {validation.errors.coordinate}
          </Text>
        ) : null}
      </Card>
    </VStack>
  );
}

function FormSection({
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
        style={{ color: theme.text, fontFamily: eight2FiveFonts.styleSemibold }}
      >
        {title}
      </Heading>
      <Card
        style={{
          gap: eight2FiveSpacing.md,
          borderRadius: eight2FiveRadii.md,
          borderColor: theme.border,
          backgroundColor: theme.surfaceRaised,
        }}
      >
        {children}
      </Card>
    </VStack>
  );
}

function TextField({
  label,
  value,
  error,
  helper,
  disabled,
  numeric = false,
  onChangeText,
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  disabled: boolean;
  numeric?: boolean;
  onChangeText(value: string): void;
}) {
  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Input isDisabled={disabled}>
        <InputField
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          inputMode={numeric ? "decimal" : "text"}
          keyboardType={numeric ? "decimal-pad" : "default"}
          accessibilityLabel={label}
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

function SelectField<Value extends string>({
  label,
  value,
  choices,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: Value;
  choices: readonly { readonly label: string; readonly value: Value }[];
  error?: string;
  disabled: boolean;
  onChange(value: Value): void;
}) {
  return (
    <FormControl isInvalid={Boolean(error)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select
        selectedValue={value}
        onValueChange={(next) => onChange(next as Value)}
        isDisabled={disabled}
      >
        <SelectTrigger>
          <SelectInput
            value={
              choices.find((choice) => choice.value === value)?.label ?? value
            }
          />
          <SelectIcon as={ChevronDown} />
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
      {error ? (
        <FormControlError accessibilityRole="alert">
          <FormControlErrorText>{error}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}
