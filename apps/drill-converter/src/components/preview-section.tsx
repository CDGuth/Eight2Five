import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { CoordinateSheetImportResult } from "@eight2five/drill-importers";
import {
  drillSetSchema,
  formatSetName,
  type DrillDocument,
  type DrillSet,
} from "@eight2five/drill-schema";
import { Divider } from "@eight2five/ui/components/divider";
import { Icon } from "@eight2five/ui/components/icon";
import { Pencil } from "lucide-react-native";

import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "../ui/form-controls";
import { colors, radius, spacing } from "../ui/theme";

export function PreviewSection({
  importResult,
  outputDocument,
  settingsErrors,
  summary,
  canDownload,
  onEditEntityLabel,
  onUpdateSet,
  onDownload,
}: {
  readonly importResult?: CoordinateSheetImportResult;
  readonly outputDocument?: DrillDocument;
  readonly settingsErrors: readonly string[];
  readonly summary?: {
    readonly performers: number;
    readonly props: number;
    readonly primarySets: number;
    readonly setEntries: number;
    readonly positions: number;
  };
  readonly canDownload: boolean;
  readonly onEditEntityLabel: (label: string) => void;
  readonly onUpdateSet: (set: DrillSet) => string | undefined;
  readonly onDownload: () => void;
}) {
  const [editingSet, setEditingSet] = React.useState<DrillSet>();
  const diagnostics = importResult?.diagnostics ?? [];
  const errors = [
    ...settingsErrors,
    ...diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnostic.message),
  ];
  const warnings = diagnostics
    .filter((diagnostic) => diagnostic.severity === "warning")
    .map((diagnostic) => diagnostic.message);

  return (
    <SectionCard
      title="3. Validate and download"
      description="The download is enabled only after the parsed data passes the current portable Eight2Five schema."
    >
      {!importResult ? (
        <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
          Choose a PDF to see parsed performers, sets, coordinates, and
          validation results.
        </Text>
      ) : null}

      {errors.length > 0 ? (
        <DiagnosticBox title="Needs attention" messages={errors} tone="error" />
      ) : null}
      {warnings.length > 0 ? (
        <DiagnosticBox title="Warnings" messages={warnings} tone="warning" />
      ) : null}

      {outputDocument && summary ? (
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            <Metric label="Performers" value={summary.performers} />
            <Metric label="Props" value={summary.props} />
            <Metric label="Primary sets" value={summary.primarySets} />
            <Metric label="Set entries" value={summary.setEntries} />
            <Metric label="Positions" value={summary.positions} />
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.lg,
            }}
          >
            <ScrollablePreviewBox title="Entities">
              {outputDocument.entities.map((entity, index) => (
                <React.Fragment key={entity.id}>
                  {index > 0 ? <PreviewDivider /> : null}
                  <PreviewRow
                    text={`${entity.label} · ${entity.type} · symbol ${entity.symbol}`}
                    editLabel={`Edit ${entity.label}`}
                    onEdit={() => onEditEntityLabel(entity.label)}
                  />
                </React.Fragment>
              ))}
            </ScrollablePreviewBox>

            <ScrollablePreviewBox title="Sets">
              {outputDocument.sets.map((set, index) => {
                const measures = set.measureRange
                  ? set.measureRange.start === set.measureRange.end
                    ? `m. ${set.measureRange.start}`
                    : `m. ${set.measureRange.start}–${set.measureRange.end}`
                  : "measures —";
                return (
                  <React.Fragment key={set.id}>
                    {index > 0 ? <PreviewDivider /> : null}
                    <PreviewRow
                      text={`${formatSetName(set)} · ${set.countsFromPrevious} ct · ${measures}`}
                      editLabel={`Edit set ${formatSetName(set)}`}
                      onEdit={() => setEditingSet(set)}
                    />
                  </React.Fragment>
                );
              })}
            </ScrollablePreviewBox>
          </View>

          <View
            style={{
              borderRadius: radius.sm,
              padding: spacing.md,
              backgroundColor: colors.successSoft,
            }}
          >
            <Text
              selectable
              style={{ color: colors.success, fontSize: 13, lineHeight: 19 }}
            >
              Valid Eight2Five {outputDocument.schemaVersion} drill document.
              The first set has zero incoming counts, set IDs follow array
              order, and all entity/set references validate.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ maxWidth: 320 }}>
        <PrimaryButton
          label="Download Eight2Five JSON"
          onPress={onDownload}
          disabled={!canDownload}
        />
      </View>

      {editingSet ? (
        <SetEditModal
          key={`${editingSet.id}-${editingSet.number}-${editingSet.suffix ?? ""}-${editingSet.countsFromPrevious}`}
          set={editingSet}
          onClose={() => setEditingSet(undefined)}
          onSave={onUpdateSet}
        />
      ) : null}
    </SectionCard>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <View
      style={{
        minWidth: 116,
        gap: 2,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text
        selectable
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ScrollablePreviewBox({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, minWidth: 260, gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
        {title}
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceMuted,
          overflow: "hidden",
        }}
      >
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={{ maxHeight: 260 }}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

function PreviewDivider() {
  return (
    <Divider
      style={{
        height: 1,
        width: "100%",
        backgroundColor: colors.border,
      }}
    />
  );
}

function PreviewRow({
  text,
  editLabel,
  onEdit,
}: {
  readonly text: string;
  readonly editLabel: string;
  readonly onEdit: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <Text
        selectable
        style={{ flex: 1, color: colors.text, fontSize: 12, lineHeight: 17 }}
      >
        {text}
      </Text>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={editLabel}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 30,
          height: 30,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.sm,
          backgroundColor: pressed ? colors.accentSoft : "transparent",
        })}
      >
        <Icon as={Pencil} size="sm" color={colors.accentText} />
      </Pressable>
    </View>
  );
}

function SetEditModal({
  set,
  onClose,
  onSave,
}: {
  readonly set: DrillSet;
  readonly onClose: () => void;
  readonly onSave: (set: DrillSet) => string | undefined;
}) {
  const [number, setNumber] = React.useState(String(set.number));
  const [suffix, setSuffix] = React.useState(set.suffix ?? "");
  const [counts, setCounts] = React.useState(String(set.countsFromPrevious));
  const [measureStart, setMeasureStart] = React.useState(
    set.measureRange ? String(set.measureRange.start) : "",
  );
  const [measureEnd, setMeasureEnd] = React.useState(
    set.measureRange ? String(set.measureRange.end) : "",
  );
  const [error, setError] = React.useState<string>();

  const save = () => {
    const parsedNumber = parseNonNegativeInteger(number);
    if (parsedNumber === undefined) {
      setError("Set number must be a non-negative whole number.");
      return;
    }
    const parsedCounts = parseNonNegativeInteger(counts);
    if (parsedCounts === undefined) {
      setError("Counts from previous must be a non-negative whole number.");
      return;
    }

    const trimmedSuffix = suffix.trim();
    const hasMeasureStart = measureStart.trim().length > 0;
    const hasMeasureEnd = measureEnd.trim().length > 0;
    if (hasMeasureStart !== hasMeasureEnd) {
      setError(
        "Enter both measure start and measure end, or leave both blank.",
      );
      return;
    }

    let measureRange: DrillSet["measureRange"];
    if (hasMeasureStart && hasMeasureEnd) {
      const start = parseNonNegativeInteger(measureStart);
      const end = parseNonNegativeInteger(measureEnd);
      if (start === undefined || end === undefined) {
        setError("Measure numbers must be non-negative whole numbers.");
        return;
      }
      measureRange = { start, end };
    }

    const candidate = {
      id: set.id,
      number: parsedNumber,
      ...(trimmedSuffix ? { suffix: trimmedSuffix } : {}),
      kind: trimmedSuffix ? ("subset" as const) : ("set" as const),
      countsFromPrevious: parsedCounts,
      ...(measureRange ? { measureRange } : {}),
    };
    const parsed = drillSetSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "The set values are invalid.",
      );
      return;
    }

    const documentError = onSave(parsed.data);
    if (documentError) {
      setError(documentError);
      return;
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
          backgroundColor: "rgba(15, 23, 42, 0.42)",
        }}
      >
        <View
          style={{
            width: 560,
            maxWidth: "100%",
            maxHeight: "90%",
            gap: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            backgroundColor: colors.surface,
            boxShadow: "0 18px 60px rgba(15, 23, 42, 0.22)",
          }}
        >
          <View style={{ gap: 3 }}>
            <Text
              style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}
            >
              Edit set {formatSetName(set)}
            </Text>
            <Text
              selectable
              style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}
            >
              Set identity uses a numeric number plus an optional suffix. A
              blank suffix is a primary set; a capital letter or decimal suffix
              such as A or .5 makes it a subset.
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 520 }}>
            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, minWidth: 180 }}>
                  <FormField
                    label="Set number"
                    value={number}
                    onChangeText={setNumber}
                    inputMode="numeric"
                    placeholder="32"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <FormField
                    label="Suffix"
                    value={suffix}
                    onChangeText={setSuffix}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="Optional, e.g. A or .5"
                  />
                </View>
              </View>

              <FormField
                label="Counts from previous"
                value={counts}
                onChangeText={setCounts}
                inputMode="numeric"
                placeholder="16"
              />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, minWidth: 180 }}>
                  <FormField
                    label="Measure start"
                    value={measureStart}
                    onChangeText={setMeasureStart}
                    inputMode="numeric"
                    placeholder="Optional"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <FormField
                    label="Measure end"
                    value={measureEnd}
                    onChangeText={setMeasureEnd}
                    inputMode="numeric"
                    placeholder="Optional"
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {error ? (
            <Text
              selectable
              accessibilityRole="alert"
              style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}
            >
              {error}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: spacing.sm,
            }}
          >
            <SecondaryButton label="Cancel" onPress={onClose} />
            <View style={{ minWidth: 120 }}>
              <PrimaryButton label="Save set" onPress={save} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function parseNonNegativeInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9][0-9]*)$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function DiagnosticBox({
  title,
  messages,
  tone,
}: {
  readonly title: string;
  readonly messages: readonly string[];
  readonly tone: "error" | "warning";
}) {
  const foreground = tone === "error" ? colors.danger : colors.warning;
  const background = tone === "error" ? colors.dangerSoft : colors.warningSoft;
  return (
    <View
      accessibilityRole="alert"
      style={{
        gap: spacing.sm,
        borderRadius: radius.sm,
        padding: spacing.md,
        backgroundColor: background,
      }}
    >
      <Text style={{ color: foreground, fontWeight: "800", fontSize: 13 }}>
        {title}
      </Text>
      {messages.map((message, index) => (
        <Text
          key={`${message}-${index}`}
          selectable
          style={{ color: foreground, fontSize: 12, lineHeight: 17 }}
        >
          • {message}
        </Text>
      ))}
    </View>
  );
}
