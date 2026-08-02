import React from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";

import { DetailsSection } from "./components/details-section";
import { EntitySettingsSection } from "./components/entity-settings-section";
import { FileSection } from "./components/file-section";
import { PreviewSection } from "./components/preview-section";
import { useConverterController } from "./converter/use-converter-controller";
import { colors, spacing } from "./ui/theme";

export function ConverterScreen() {
  const controller = useConverterController();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(
    1040,
    Math.max(0, width - (width < 720 ? 28 : 64)),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{
        alignItems: "center",
        paddingHorizontal: width < 720 ? 14 : 32,
        paddingVertical: width < 720 ? 24 : 40,
      }}
    >
      <View style={{ width: contentWidth, maxWidth: "100%", gap: spacing.xl }}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Text
            selectable
            style={{
              color: colors.text,
              fontSize: width < 720 ? 28 : 36,
              lineHeight: width < 720 ? 34 : 43,
              fontWeight: "800",
              letterSpacing: -0.6,
            }}
          >
            Coordinate Sheet Converter
          </Text>
          <Text
            selectable
            style={{
              maxWidth: 760,
              color: colors.textMuted,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Convert Pyware-style coordinate-sheet PDFs into the portable
            Eight2Five drill JSON schema. Sets, counts, measures, performers,
            and marching-grid positions are extracted locally in your browser.
          </Text>
        </View>

        <FileSection
          asset={controller.asset}
          phase={controller.phase}
          extractionError={controller.extractionError}
          pageCount={controller.extractedPages.length}
          pdfJsVersion={controller.pdfJsVersion}
          onPick={() => void controller.pickPdf()}
          onClear={controller.clearPdf}
        />

        <DetailsSection
          settings={controller.settings}
          errors={controller.settingsErrors}
          onUpdate={controller.updateSettings}
        />

        <EntitySettingsSection
          settings={controller.settings}
          availableSymbols={controller.availableSymbols}
          errors={controller.settingsErrors}
          onUpdate={controller.updateSettings}
          onTogglePropSymbol={controller.togglePropSymbol}
          onAddRule={controller.addRule}
          onUpdateRule={controller.updateRule}
          onRemoveRule={controller.removeRule}
        />

        <PreviewSection
          importResult={controller.importResult}
          outputDocument={controller.outputDocument}
          settingsErrors={controller.settingsErrors}
          summary={controller.summary}
          canDownload={controller.canDownload}
          onDownload={controller.download}
        />

        <View style={{ paddingVertical: spacing.md, gap: 4 }}>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            Eight2Five drill schema v1.0.0 · No account, backend, database,
            analytics, or PDF upload.
          </Text>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            v1 expects PDFs with extractable text. OCR and image-only coordinate
            sheets are intentionally out of scope.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
