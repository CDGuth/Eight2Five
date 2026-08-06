import React from "react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import {
  getDrillTerms,
  type Drill,
  type DrillDocument,
  type DrillRepository,
} from "@eight2five/mobile/drill";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  importEight2FiveDrillDocument,
  parseDrillPickerResult,
} from "./drill-import";
import {
  deleteDrillAndRefreshSettings,
  loadDrillList,
  toError,
  type DrillListEntry,
} from "./drill-management";

interface PendingImport {
  readonly document: DrillDocument;
  readonly fileName: string;
}

export interface DrillPropertiesDialogState {
  readonly drill: Drill;
  readonly document?: DrillDocument;
}

export interface PerformerSelectionDialogState {
  readonly drill?: Drill;
  readonly document: DrillDocument;
}

export function useDrillListController() {
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [entries, setEntries] = React.useState<readonly DrillListEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error>();
  const [busyDrillId, setBusyDrillId] = React.useState<string>();
  const [pendingImport, setPendingImport] = React.useState<PendingImport>();
  const [selectedFileName, setSelectedFileName] = React.useState<string>();
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<Error>();
  const [propertiesDialog, setPropertiesDialog] =
    React.useState<DrillPropertiesDialogState>();
  const [propertiesLoading, setPropertiesLoading] = React.useState(false);
  const [propertiesError, setPropertiesError] = React.useState<Error>();
  const [performerDialog, setPerformerDialog] =
    React.useState<PerformerSelectionDialogState>();
  const [performerLoading, setPerformerLoading] = React.useState(false);
  const [performerError, setPerformerError] = React.useState<Error>();
  const mutationInFlight = React.useRef(false);
  const pickerInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    try {
      setEntries(await loadDrillList(store.getDrillRepository()));
      setError(undefined);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setLoading(false);
    }
  }, [snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const mutate = React.useCallback(
    async <T>(
      drillId: string,
      operation: (repository: DrillRepository) => Promise<T>,
    ) => {
      if (mutationInFlight.current) {
        throw new Error("Another drill update is in progress.");
      }
      mutationInFlight.current = true;
      setBusyDrillId(drillId);
      setError(undefined);
      try {
        const result = await operation(store.getDrillRepository());
        await refresh();
        return result;
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        mutationInFlight.current = false;
        setBusyDrillId(undefined);
      }
    },
    [refresh, store],
  );

  const importDocument = React.useCallback(
    async (document: DrillDocument, performerEntityId: number) => {
      if (snapshot.status !== "ready" || mutationInFlight.current) return;
      mutationInFlight.current = true;
      setImporting(true);
      setImportError(undefined);
      setError(undefined);
      try {
        await importEight2FiveDrillDocument(
          store.getDrillRepository(),
          document,
          performerEntityId,
        );
        setPendingImport(undefined);
        await refresh();
      } catch (cause) {
        const importOperationError = toError(cause);
        setImportError(importOperationError);
        setError(importOperationError);
      } finally {
        mutationInFlight.current = false;
        setImporting(false);
      }
    },
    [refresh, snapshot.status, store],
  );

  const pickFile = React.useCallback(async () => {
    if (
      snapshot.status !== "ready" ||
      mutationInFlight.current ||
      pickerInFlight.current
    ) {
      return;
    }
    pickerInFlight.current = true;
    setUploadBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const parsed = await parseDrillPickerResult(result, (uri) =>
        new File(uri).text(),
      );
      if (!parsed) return;

      setSelectedFileName(parsed.fileName);
      setError(undefined);
      setImportError(undefined);
      const performers = parsed.document.entities.filter(
        (entity) => entity.type === "performer",
      );
      if (performers.length > 1) {
        setPendingImport(parsed);
        return;
      }
      const performer = performers[0];
      if (!performer) return;
      await importDocument(parsed.document, performer.id);
    } catch (cause) {
      const pickerError = toError(cause);
      setError(pickerError);
      setImportError(pickerError);
    } finally {
      pickerInFlight.current = false;
      setUploadBusy(false);
    }
  }, [importDocument, snapshot.status]);

  const cancelPendingImport = React.useCallback(() => {
    if (importing) return;
    setPendingImport(undefined);
    setImportError(undefined);
  }, [importing]);

  const importPendingDocument = React.useCallback(
    async (performerEntityId: number) => {
      if (!pendingImport) return;
      await importDocument(pendingImport.document, performerEntityId);
    },
    [importDocument, pendingImport],
  );

  const toggleActive = React.useCallback(
    async (drill: Drill) => {
      if (mutationInFlight.current || snapshot.status !== "ready") return;
      mutationInFlight.current = true;
      setBusyDrillId(drill.id);
      setError(undefined);
      try {
        await store.setActiveDrill(
          snapshot.settings.activeDrillId === drill.id ? null : drill.id,
        );
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        mutationInFlight.current = false;
        setBusyDrillId(undefined);
      }
    },
    [snapshot.settings.activeDrillId, snapshot.status, store],
  );

  const openProperties = React.useCallback(
    async (drill: Drill) => {
      if (snapshot.status !== "ready") return;
      setPropertiesDialog({ drill });
      setPropertiesLoading(true);
      setPropertiesError(undefined);
      try {
        const document = await store
          .getDrillRepository()
          .getDrillDocument(drill.id);
        setPropertiesDialog((current) =>
          current?.drill.id === drill.id ? { drill, document } : current,
        );
      } catch (cause) {
        setPropertiesError(toError(cause));
      } finally {
        setPropertiesLoading(false);
      }
    },
    [snapshot.status, store],
  );

  const closeProperties = React.useCallback(() => {
    if (!propertiesLoading) {
      setPropertiesDialog(undefined);
      setPropertiesError(undefined);
    }
  }, [propertiesLoading]);

  const openPerformerSelection = React.useCallback(
    async (drill: Drill) => {
      if (snapshot.status !== "ready") return;
      setPerformerLoading(true);
      setPerformerError(undefined);
      try {
        const document = await store
          .getDrillRepository()
          .getDrillDocument(drill.id);
        if (!document) {
          throw new Error(
            "This drill does not contain an imported performer list.",
          );
        }
        setPerformerDialog({ drill, document });
      } catch (cause) {
        setPerformerError(toError(cause));
      } finally {
        setPerformerLoading(false);
      }
    },
    [snapshot.status, store],
  );

  const closePerformerSelection = React.useCallback(() => {
    if (!busyDrillId) {
      setPerformerDialog(undefined);
      setPerformerError(undefined);
    }
  }, [busyDrillId]);

  const selectPerformer = React.useCallback(
    async (performerEntityId: number) => {
      const current = performerDialog;
      if (!current?.drill) return;
      try {
        await mutate(current.drill.id, (repository) =>
          repository.setSelectedPerformer(current.drill!.id, performerEntityId),
        );
        setPerformerDialog(undefined);
      } catch (cause) {
        setPerformerError(toError(cause));
      }
    },
    [mutate, performerDialog],
  );

  const remove = React.useCallback(
    async (drill: Drill) =>
      await mutate(drill.id, async (repository) => {
        await deleteDrillAndRefreshSettings(repository, drill.id, () =>
          store.reload(),
        );
        setPropertiesDialog(undefined);
      }),
    [mutate, store],
  );

  return {
    entries,
    loading: snapshot.status === "loading" || loading,
    error: error ?? snapshot.error,
    busyDrillId,
    activeDrillId: snapshot.settings.activeDrillId,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    refresh,
    pickFile,
    uploadBusy,
    selectedFileName,
    pendingImport,
    importing,
    importError,
    cancelPendingImport,
    importPendingDocument,
    toggleActive,
    openProperties,
    closeProperties,
    propertiesDialog,
    propertiesLoading,
    propertiesError,
    openPerformerSelection,
    closePerformerSelection,
    performerDialog,
    performerLoading,
    performerError,
    selectPerformer,
    remove,
  } as const;
}
