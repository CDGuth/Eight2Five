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
  const { addLabelOverride } = controller;
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [rulesSectionY, setRulesSectionY] = React.useState(0);
  const [rulesFocusRequestKey, setRulesFocusRequestKey] = React.useState(0);
  const { width } = useWindowDimensions();

  const addEntityLabelRule = React.useCallback(
    (label: string) => {
      addLabelOverride(label);
      setRulesFocusRequestKey((key) => key + 1);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, rulesSectionY - spacing.md),
          animated: true,
        });
      });
    },
    [addLabelOverride, rulesSectionY],
  );

  return (
    <ScrollView
      ref={scrollViewRef}
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{
        alignItems: "center",
        paddingHorizontal: width < 720 ? 14 : 32,
        paddingVertical: width < 720 ? 24 : 40,
      }}
    >
      <View style={{ width: "100%", maxWidth: 1040, gap: spacing.xl }}>
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

        <View
          onLayout={(event) => setRulesSectionY(event.nativeEvent.layout.y)}
        >
          <EntitySettingsSection
            settings={controller.settings}
            availableSymbols={controller.availableSymbols}
            errors={controller.settingsErrors}
            focusRequestKey={rulesFocusRequestKey}
            onUpdate={controller.updateSettings}
            onAddRule={controller.addRule}
            onUpdateRule={controller.updateRule}
            onRemoveRule={controller.removeRule}
          />
        </View>

        <PreviewSection
          importResult={controller.importResult}
          outputDocument={controller.outputDocument}
          settingsErrors={controller.settingsErrors}
          summary={controller.summary}
          canDownload={controller.canDownload}
          onAddEntityLabelRule={addEntityLabelRule}
          onUpdateEntityIdentity={controller.updateEntityIdentity}
          onUpdateSet={controller.updateSet}
          onDownload={controller.download}
        />

        <View style={{ paddingVertical: spacing.md, gap: 4 }}>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            Eight2Five drill schema · No account, backend, database, analytics,
            or PDF upload.
          </Text>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            The current parser expects PDFs with extractable text. OCR and
            image-only coordinate sheets are intentionally out of scope.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
