import React from "react";
import { Pressable, Text, View } from "react-native";

import {
  ChoiceChips,
  Disclosure,
  FormField,
  SecondaryButton,
  ToggleRow,
} from "../ui/form-controls";
import { colors, radius, spacing } from "../ui/theme";
import {
  COLOR_PRESET_OPTIONS,
  ENTITY_ICON_OPTIONS,
  type ConverterSettings,
  type EntityRuleDraft,
} from "../converter/settings";

const TARGET_OPTIONS = Object.freeze([
  { value: "symbol", label: "Symbol" },
  { value: "label", label: "Label" },
  { value: "id", label: "ID" },
] as const);

const LABEL_OPTIONS = Object.freeze([
  { value: "inherit", label: "Default" },
  { value: "visible", label: "Show" },
  { value: "hidden", label: "Hide" },
] as const);

export function EntitySettingsSection({
  settings,
  availableSymbols,
  errors,
  onUpdate,
  onTogglePropSymbol,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}: {
  readonly settings: ConverterSettings;
  readonly availableSymbols: readonly string[];
  readonly errors: readonly string[];
  readonly onUpdate: (patch: Partial<ConverterSettings>) => void;
  readonly onTogglePropSymbol: (symbol: string) => void;
  readonly onAddRule: (target?: EntityRuleDraft["target"]) => void;
  readonly onUpdateRule: (
    id: string,
    patch: Partial<Omit<EntityRuleDraft, "id">>,
  ) => void;
  readonly onRemoveRule: (id: string) => void;
}) {
  const ruleErrors = errors.filter(
    (error) => error.startsWith("Rule ") || error.startsWith("Duplicate "),
  );
  return (
    <Disclosure
      title="Performer, prop, and appearance rules"
      description="Optional. Use symbol rules for broad defaults, then label or ID rules for exceptions. Specific entity data remains highest priority."
    >
      <View style={{ gap: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
          Entity type by symbol
        </Text>
        {availableSymbols.length === 0 ? (
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
          >
            Select and parse a PDF first. Every extracted symbol defaults to a
            performer; mark prop symbols here when needed.
          </Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {availableSymbols.map((symbol) => (
              <ToggleRow
                key={symbol}
                title={`${symbol} is a prop`}
                description={
                  settings.propSymbols.includes(symbol)
                    ? "Props default to square field icons."
                    : "Performers default to dot field icons."
                }
                value={settings.propSymbols.includes(symbol)}
                onChange={() => onTogglePropSymbol(symbol)}
              />
            ))}
          </View>
        )}
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.lg,
          gap: spacing.md,
        }}
      >
        <View style={{ gap: 3 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
            Rules and overrides
          </Text>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
          >
            Precedence is symbol → label → ID → explicit entity values. Leave a
            field blank to inherit the broader rule or schema default.
          </Text>
        </View>

        {settings.rules.map((rule, index) => (
          <RuleEditor
            key={rule.id}
            index={index}
            rule={rule}
            availableSymbols={availableSymbols}
            onUpdate={(patch) => onUpdateRule(rule.id, patch)}
            onRemove={() => onRemoveRule(rule.id)}
          />
        ))}

        {ruleErrors.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            {ruleErrors.map((error) => (
              <Text
                key={error}
                selectable
                accessibilityRole="alert"
                style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}
              >
                {error}
              </Text>
            ))}
          </View>
        ) : null}

        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <SecondaryButton
            label="Add symbol rule"
            onPress={() => onAddRule("symbol")}
          />
          <SecondaryButton
            label="Add label override"
            onPress={() => onAddRule("label")}
          />
          <SecondaryButton
            label="Add ID override"
            onPress={() => onAddRule("id")}
          />
        </View>
      </View>

      <ToggleRow
        title="Write explicit straight paths"
        description="Normally omitted because a missing path means straight-line movement in Eight2Five v1. Enable this only when you want the JSON to contain every straight transition explicitly."
        value={settings.explicitStraightPaths}
        onChange={(explicitStraightPaths) =>
          onUpdate({ explicitStraightPaths })
        }
      />
      <ToggleRow
        title="Include source row references"
        description="Keeps PDF page numbers and raw coordinate-row text in provenance for debugging and future re-import work."
        value={settings.includeSourceReferences}
        onChange={(includeSourceReferences) =>
          onUpdate({ includeSourceReferences })
        }
      />
    </Disclosure>
  );
}

function RuleEditor({
  index,
  rule,
  availableSymbols,
  onUpdate,
  onRemove,
}: {
  readonly index: number;
  readonly rule: EntityRuleDraft;
  readonly availableSymbols: readonly string[];
  readonly onUpdate: (patch: Partial<Omit<EntityRuleDraft, "id">>) => void;
  readonly onRemove: () => void;
}) {
  const colorMatchesPreset = COLOR_PRESET_OPTIONS.some(
    (option) => option.value.toLowerCase() === rule.color.toLowerCase(),
  );
  return (
    <View
      style={{
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.lg,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
          Rule {index + 1}
        </Text>
        <View style={{ minWidth: 90 }}>
          <SecondaryButton label="Remove" danger onPress={onRemove} />
        </View>
      </View>

      <ChoiceChips
        label="Target"
        value={rule.target}
        options={TARGET_OPTIONS}
        onChange={(target) => onUpdate({ target, key: "" })}
      />
      {rule.target === "symbol" && availableSymbols.length > 0 ? (
        <ChoiceChips
          label="Detected symbol"
          value={availableSymbols.includes(rule.key) ? rule.key : ""}
          options={[
            { value: "", label: "Custom" },
            ...availableSymbols.map((symbol) => ({
              value: symbol,
              label: symbol,
            })),
          ]}
          onChange={(key) => onUpdate({ key })}
        />
      ) : null}
      <FormField
        label={
          rule.target === "symbol"
            ? "Symbol"
            : rule.target === "label"
              ? "Exact label"
              : "Exact ID"
        }
        value={rule.key}
        onChangeText={(key) => onUpdate({ key })}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={
          rule.target === "symbol"
            ? "B"
            : rule.target === "label"
              ? "B1"
              : "1595433022185"
        }
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 220 }}>
          <FormField
            label="Section"
            value={rule.section}
            onChangeText={(section) => onUpdate({ section })}
            placeholder="Optional"
          />
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <FormField
            label="Instrument"
            value={rule.instrument}
            onChangeText={(instrument) => onUpdate({ instrument })}
            placeholder="Optional"
          />
        </View>
      </View>

      <ChoiceChips
        label="Field icon"
        value={rule.icon}
        options={[
          { value: "", label: "Default" },
          ...ENTITY_ICON_OPTIONS.map((icon) => ({
            value: icon,
            label: titleCase(icon),
          })),
        ]}
        onChange={(icon) => onUpdate({ icon })}
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
          Color
        </Text>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <ColorChip
            label="Default"
            color={undefined}
            selected={!rule.color}
            onPress={() => onUpdate({ color: "" })}
          />
          {COLOR_PRESET_OPTIONS.map((option) => (
            <ColorChip
              key={option.value}
              label={option.label}
              color={option.value}
              selected={rule.color.toLowerCase() === option.value.toLowerCase()}
              onPress={() => onUpdate({ color: option.value })}
            />
          ))}
        </View>
        <FormField
          label="Custom hex color"
          value={colorMatchesPreset ? "" : rule.color}
          onChangeText={(color) => onUpdate({ color })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="#3c6ec8"
          helper="Leave blank for the selected preset/default. Any six-digit hex color is valid."
        />
      </View>

      <ChoiceChips
        label="Label visibility"
        value={rule.labelVisibility}
        options={LABEL_OPTIONS}
        onChange={(labelVisibility) => onUpdate({ labelVisibility })}
      />
    </View>
  );
}

function ColorChip({
  label,
  color,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly color?: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 38,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: 999,
        paddingHorizontal: 12,
        backgroundColor: selected
          ? colors.accentSoft
          : pressed
            ? colors.surfaceMuted
            : colors.surface,
      })}
    >
      {color ? (
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.15)",
          }}
        />
      ) : null}
      <Text
        style={{
          color: selected ? colors.accentText : colors.text,
          fontSize: 12,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
