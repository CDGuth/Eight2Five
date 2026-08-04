import React from "react";
import { Text, View } from "react-native";
import {
  getFieldPreset,
  getGridReference,
  type FieldPresetId,
} from "@eight2five/drill-schema";

import {
  ChoiceChips,
  Disclosure,
  FormField,
  SectionCard,
} from "../ui/form-controls";
import { colors, radius, spacing } from "../ui/theme";
import {
  FIELD_PRESET_OPTIONS,
  type ConverterSettings,
} from "../converter/settings";

const FIELD_OPTIONS = Object.freeze([
  ...FIELD_PRESET_OPTIONS,
  { value: "custom", label: "Custom" },
] as const);

export function DetailsSection({
  settings,
  errors,
  onUpdate,
}: {
  readonly settings: ConverterSettings;
  readonly errors: readonly string[];
  readonly onUpdate: (patch: Partial<ConverterSettings>) => void;
}) {
  const titleError = errors.find((error) => error.includes("title"));
  const customFieldError = errors.find((error) =>
    error.startsWith("Custom field"),
  );
  return (
    <SectionCard
      title="2. Drill details"
      description="The converter only asks for the information needed to produce a valid, useful drill file. Less common schema fields stay under optional sections."
    >
      <FormField
        label="Title"
        value={settings.title}
        onChangeText={(title) => onUpdate({ title })}
        placeholder="Part 4"
        error={titleError}
      />

      <ChoiceChips
        label="Field convention"
        value={settings.fieldMode}
        options={FIELD_OPTIONS}
        onChange={(fieldMode) => onUpdate({ fieldMode })}
      />

      {settings.fieldMode === "custom" ? (
        <FormField
          label="Custom field definition"
          value={settings.customFieldJson}
          onChangeText={(customFieldJson) => onUpdate({ customFieldJson })}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          error={customFieldError}
          helper="Advanced: paste a custom field object with matched physical and marching reference lines. The editor starts from NFHS geometry so you can change only what differs."
        />
      ) : (
        <FieldPresetSummary preset={settings.fieldMode} />
      )}

      <Disclosure
        title="Optional metadata"
        description="Writer, ensemble, description, and an optional Lucide icon name."
      >
        <FormField
          label="Drill writer"
          value={settings.drillWriter}
          onChangeText={(drillWriter) => onUpdate({ drillWriter })}
          placeholder="Optional"
        />
        <FormField
          label="Ensemble"
          value={settings.ensemble}
          onChangeText={(ensemble) => onUpdate({ ensemble })}
          placeholder="Optional"
        />
        <FormField
          label="Description"
          value={settings.description}
          onChangeText={(description) => onUpdate({ description })}
          multiline
          placeholder="Optional notes about this movement"
        />
        <FormField
          label="Lucide icon"
          value={settings.lucideIcon}
          onChangeText={(lucideIcon) => onUpdate({ lucideIcon })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="music-2"
          helper="Optional kebab-case Lucide icon name stored as metadata. The converter does not download icon assets."
        />
      </Disclosure>
    </SectionCard>
  );
}

function FieldPresetSummary({ preset }: { readonly preset: FieldPresetId }) {
  const field = getFieldPreset(preset);
  const frontHash = getGridReference({ type: "preset", preset }, "front-hash");
  const backHash = getGridReference({ type: "preset", preset }, "back-hash");
  const backSideline = getGridReference(
    { type: "preset", preset },
    "back-sideline",
  );
  return (
    <View
      style={{
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: spacing.md,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text
        selectable
        style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}
      >
        {field.name}
      </Text>
      <Text
        selectable
        style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
      >
        Origin: center of the 50 on the front sideline · Side 1 is negative X ·
        Side 2 is positive X · backfield is positive Y.
      </Text>
      <Text
        selectable
        style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
      >
        Marching grid: Front sideline 0 · Front hash{" "}
        {formatNumber(frontHash?.coordinateSteps)} · Back hash{" "}
        {formatNumber(backHash?.coordinateSteps)} · Back sideline{" "}
        {formatNumber(backSideline?.coordinateSteps)}.
      </Text>
    </View>
  );
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return "—";
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
