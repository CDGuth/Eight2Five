import React from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  importCoordinateSheetPages,
  type CoordinateSheetImportResult,
  type ExtractedPdfPage,
} from "@eight2five/drill-importers";
import {
  serializeDrillDocument,
  type DrillDocument,
} from "@eight2five/drill-schema";

import { downloadTextFile } from "./download.web";
import {
  applyConverterSettings,
  createDefaultConverterSettings,
  createEmptyRuleDraft,
  downloadFileName,
  getDocumentSummary,
  inferTitleFromFileName,
  validateConverterSettings,
  type ConverterSettings,
  type EntityIdentityOverride,
  type EntityRuleDraft,
} from "./settings";
import { extractPdfText, getPdfJsVersion } from "../pdf/pdf-text-extractor.web";

export type ConverterPhase = "idle" | "extracting" | "ready" | "error";

let nextRuleId = 1;

export function useConverterController() {
  const [settings, setSettings] = React.useState<ConverterSettings>(
    createDefaultConverterSettings,
  );
  const [asset, setAsset] =
    React.useState<DocumentPicker.DocumentPickerAsset>();
  const [extractedPages, setExtractedPages] = React.useState<
    readonly ExtractedPdfPage[]
  >([]);
  const [createdAt, setCreatedAt] = React.useState(() =>
    new Date().toISOString(),
  );
  const [phase, setPhase] = React.useState<ConverterPhase>("idle");
  const [extractionError, setExtractionError] = React.useState<string>();

  const settingsValidation = React.useMemo(
    () => validateConverterSettings(settings),
    [settings],
  );

  const importResult = React.useMemo<
    CoordinateSheetImportResult | undefined
  >(() => {
    if (extractedPages.length === 0 || !settingsValidation.field)
      return undefined;
    return importCoordinateSheetPages(extractedPages, {
      title: settings.title.trim() || "Imported Drill",
      ...(asset?.name ? { fileName: asset.name } : {}),
      createdAt,
      field: settingsValidation.field,
    });
  }, [
    asset,
    createdAt,
    extractedPages,
    settings.title,
    settingsValidation.field,
  ]);

  const outputDocument = React.useMemo<DrillDocument | undefined>(() => {
    if (!importResult?.document || settingsValidation.errors.length > 0) {
      return undefined;
    }
    try {
      return applyConverterSettings(
        importResult.document,
        settings,
        settingsValidation,
      );
    } catch {
      return undefined;
    }
  }, [importResult, settings, settingsValidation]);

  const summary = React.useMemo(
    () => (outputDocument ? getDocumentSummary(outputDocument) : undefined),
    [outputDocument],
  );

  const availableSymbols = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...(importResult?.sheets ?? [])
            .map((sheet) => sheet.sourceSymbol.trim())
            .filter(Boolean),
          ...(outputDocument?.entities ?? [])
            .map((entity) => entity.symbol.trim())
            .filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [importResult?.sheets, outputDocument?.entities],
  );

  const pickPdf = React.useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const nextAsset = result.assets[0];
    setPhase("extracting");
    setExtractionError(undefined);
    setAsset(nextAsset);
    setExtractedPages([]);
    const nextCreatedAt = new Date().toISOString();
    setCreatedAt(nextCreatedAt);
    setSettings((current) => ({
      ...current,
      title: inferTitleFromFileName(nextAsset.name),
      rules: [],
      entityOverrides: [],
      setOverrides: [],
    }));

    try {
      const pages = await extractPdfText(nextAsset);
      if (
        pages.length === 0 ||
        pages.every((page) => page.items.length === 0)
      ) {
        throw new Error(
          "The PDF contains no extractable text. Scanned/image-only coordinate sheets are not currently supported.",
        );
      }
      setExtractedPages(pages);
      setPhase("ready");
    } catch (cause) {
      setPhase("error");
      setExtractionError(
        cause instanceof Error ? cause.message : "PDF text extraction failed.",
      );
    }
  }, []);

  const clearPdf = React.useCallback(() => {
    setAsset(undefined);
    setExtractedPages([]);
    setExtractionError(undefined);
    setPhase("idle");
    setSettings((current) => ({
      ...current,
      title: "",
      rules: [],
      entityOverrides: [],
      setOverrides: [],
    }));
  }, []);

  const updateSettings = React.useCallback(
    (patch: Partial<ConverterSettings>) =>
      setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  const addRule = React.useCallback(
    (target: EntityRuleDraft["target"] = "symbol") => {
      setSettings((current) => ({
        ...current,
        rules: [
          ...current.rules,
          { ...createEmptyRuleDraft(`rule-${nextRuleId++}`), target },
        ],
      }));
    },
    [],
  );

  const addLabelOverride = React.useCallback((label: string) => {
    const key = label.trim();
    if (!key) return;
    setSettings((current) => {
      const existing = current.rules.find(
        (rule) => rule.target === "label" && rule.key.trim() === key,
      );
      if (existing) {
        return {
          ...current,
          rules: [
            existing,
            ...current.rules.filter((rule) => rule.id !== existing.id),
          ],
        };
      }
      return {
        ...current,
        rules: [
          {
            ...createEmptyRuleDraft(`rule-${nextRuleId++}`),
            target: "label",
            key,
          },
          ...current.rules,
        ],
      };
    });
  }, []);

  const updateRule = React.useCallback(
    (id: string, patch: Partial<Omit<EntityRuleDraft, "id">>) => {
      setSettings((current) => ({
        ...current,
        rules: current.rules.map((rule) => {
          if (rule.id !== id) return rule;
          const nextRule = { ...rule, ...patch };
          return nextRule.entityType === "prop"
            ? { ...nextRule, section: "", instrument: "" }
            : nextRule;
        }),
      }));
    },
    [],
  );

  const removeRule = React.useCallback((id: string) => {
    setSettings((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== id),
    }));
  }, []);

  const updateEntityIdentity = React.useCallback(
    (override: EntityIdentityOverride): string | undefined => {
      if (!importResult?.document)
        return "Parse a PDF before editing entities.";
      if (
        !importResult.document.entities.some(
          (entity) => entity.id === override.id,
        )
      ) {
        return `Unknown entity id ${override.id}.`;
      }

      const nextSettings: ConverterSettings = {
        ...settings,
        entityOverrides: [
          ...settings.entityOverrides.filter(
            (entity) => entity.id !== override.id,
          ),
          {
            ...override,
            label: override.label.trim(),
            symbol: override.symbol.trim(),
          },
        ],
      };
      const validation = validateConverterSettings(nextSettings);
      try {
        applyConverterSettings(importResult.document, nextSettings, validation);
      } catch (cause) {
        return cause instanceof Error
          ? cause.message
          : "The entity edit is invalid.";
      }
      setSettings(nextSettings);
      return undefined;
    },
    [importResult, settings],
  );

  const updateSet = React.useCallback(
    (setOverride: DrillDocument["sets"][number]): string | undefined => {
      if (!importResult?.document) return "Parse a PDF before editing sets.";
      if (
        !importResult.document.sets.some((set) => set.id === setOverride.id)
      ) {
        return `Unknown set id ${setOverride.id}.`;
      }

      const nextSettings: ConverterSettings = {
        ...settings,
        setOverrides: [
          ...settings.setOverrides.filter((set) => set.id !== setOverride.id),
          setOverride,
        ],
      };
      const validation = validateConverterSettings(nextSettings);
      try {
        applyConverterSettings(importResult.document, nextSettings, validation);
      } catch (cause) {
        return cause instanceof Error
          ? cause.message
          : "The set edit is invalid.";
      }
      setSettings(nextSettings);
      return undefined;
    },
    [importResult, settings],
  );

  const download = React.useCallback(() => {
    if (!outputDocument) return;
    downloadTextFile(
      serializeDrillDocument(outputDocument),
      downloadFileName(outputDocument.metadata.title),
    );
  }, [outputDocument]);

  return {
    phase,
    asset,
    extractedPages,
    extractionError,
    settings,
    settingsErrors: settingsValidation.errors,
    importResult,
    outputDocument,
    summary,
    availableSymbols,
    pdfJsVersion: getPdfJsVersion(),
    canDownload: Boolean(outputDocument),
    pickPdf,
    clearPdf,
    updateSettings,
    addRule,
    addLabelOverride,
    updateRule,
    removeRule,
    updateEntityIdentity,
    updateSet,
    download,
  };
}
