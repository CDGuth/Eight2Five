import React from "react";
import { Pressable, Text, View } from "react-native";
import type { CoordinateSheetImportResult } from "@eight2five/drill-importers";
import { formatSetName, type DrillDocument } from "@eight2five/drill-schema";

import { PrimaryButton, SectionCard } from "../ui/form-controls";
import { colors, radius, spacing } from "../ui/theme";

export function PreviewSection({
  importResult,
  outputDocument,
  settingsErrors,
  summary,
  canDownload,
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
  readonly onDownload: () => void;
}) {
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
      description="The download is enabled only after the parsed data passes the portable Eight2Five v1 schema."
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
            <PreviewList
              key={`entities-${outputDocument.metadata.createdAt}`}
              title="Entities"
              values={outputDocument.entities.map(
                (entity) =>
                  `${entity.label} · ${entity.type} · symbol ${entity.symbol}`,
              )}
            />
            <PreviewList
              key={`sets-${outputDocument.metadata.createdAt}`}
              title="Sets"
              values={outputDocument.sets.map((set) => {
                const measures = set.measureRange
                  ? set.measureRange.start === set.measureRange.end
                    ? `m. ${set.measureRange.start}`
                    : `m. ${set.measureRange.start}–${set.measureRange.end}`
                  : "measures —";
                return `${formatSetName(set)} · ${
                  set.countsFromPrevious
                } ct · ${measures}`;
              })}
            />
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

const PREVIEW_PAGE_SIZE = 10;

function PreviewList({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  const [visibleCount, setVisibleCount] = React.useState(PREVIEW_PAGE_SIZE);
  const visibleValues = values.slice(0, visibleCount);
  const remainder = Math.max(0, values.length - visibleValues.length);

  return (
    <View style={{ flex: 1, minWidth: 260, gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
        {title}
      </Text>
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
        {visibleValues.map((value) => (
          <Text
            key={value}
            selectable
            style={{ color: colors.text, fontSize: 12, lineHeight: 17 }}
          >
            {value}
          </Text>
        ))}
        {remainder > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show more ${title.toLowerCase()}`}
            onPress={() =>
              setVisibleCount((count) =>
                Math.min(count + PREVIEW_PAGE_SIZE, values.length),
              )
            }
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              borderRadius: radius.sm,
              paddingHorizontal: spacing.xs,
              paddingVertical: 2,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ color: colors.accentText, fontSize: 12 }}>
              + {remainder} more
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
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
