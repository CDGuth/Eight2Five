import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";

import {
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "../ui/form-controls";
import { colors, radius, spacing } from "../ui/theme";
import type { ConverterPhase } from "../converter/use-converter-controller";

export function FileSection({
  asset,
  phase,
  extractionError,
  pageCount,
  pdfJsVersion,
  onPick,
  onClear,
}: {
  readonly asset?: DocumentPickerAsset;
  readonly phase: ConverterPhase;
  readonly extractionError?: string;
  readonly pageCount: number;
  readonly pdfJsVersion: string;
  readonly onPick: () => void;
  readonly onClear: () => void;
}) {
  return (
    <SectionCard
      title="1. Coordinate sheet PDF"
      description="Select a text-based coordinate-sheet PDF. Parsing happens in this browser; the PDF itself is never uploaded."
    >
      {!asset ? (
        <View style={{ maxWidth: 280 }}>
          <PrimaryButton label="Choose PDF" onPress={onPick} />
        </View>
      ) : (
        <View
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <View style={{ gap: 3 }}>
            <Text
              selectable
              style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}
            >
              {asset.name}
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 12 }}>
              {formatBytes(asset.size)}
              {pageCount > 0
                ? ` · ${pageCount} PDF page${pageCount === 1 ? "" : "s"}`
                : ""}
            </Text>
          </View>
          {phase === "extracting" ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Extracting browser text…
              </Text>
            </View>
          ) : null}
          {extractionError ? (
            <View
              style={{
                borderRadius: radius.sm,
                padding: spacing.md,
                backgroundColor: colors.dangerSoft,
              }}
            >
              <Text
                selectable
                accessibilityRole="alert"
                style={{ color: colors.danger, lineHeight: 19 }}
              >
                {extractionError}
              </Text>
            </View>
          ) : null}
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            <View style={{ minWidth: 150 }}>
              <PrimaryButton label="Choose another PDF" onPress={onPick} />
            </View>
            <View style={{ minWidth: 100 }}>
              <SecondaryButton label="Clear" onPress={onClear} />
            </View>
          </View>
        </View>
      )}
      <Text
        selectable
        style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
      >
        Text extraction uses PDF.js {pdfJsVersion}, loaded from a pinned
        jsDelivr URL. Only the library is fetched; selected PDF bytes remain
        local.
      </Text>
    </SectionCard>
  );
}

function formatBytes(value: number | undefined): string {
  if (!value || value < 1) return "PDF file";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
