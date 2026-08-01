import React from "react";
import { useFocusEffect } from "expo-router";
import {
  getDrillTerms,
  type Drill,
  type DrillPage,
} from "@eight2five/mobile/drill";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  createNamedDrill,
  deleteDrillAndRefreshSettings,
  renameNamedDrill,
  toError,
} from "./drill-management";

export function useDrillEditorController(drillId?: string) {
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [drill, setDrill] = React.useState<Drill>();
  const [pages, setPages] = React.useState<readonly DrillPage[]>([]);
  const [loading, setLoading] = React.useState(Boolean(drillId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const operationInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!drillId || snapshot.status !== "ready") return;
    try {
      const repository = store.getDrillRepository();
      const [nextDrill, nextPages] = await Promise.all([
        repository.getDrill(drillId),
        repository.listPages(drillId),
      ]);
      if (!nextDrill) throw new Error("This drill no longer exists.");
      setDrill(nextDrill);
      setPages(nextPages);
      setError(undefined);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setLoading(false);
    }
  }, [drillId, snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const saveName = React.useCallback(
    async (name: string) => {
      if (operationInFlight.current) {
        throw new Error("A save is already in progress.");
      }
      operationInFlight.current = true;
      setSaving(true);
      setError(undefined);
      try {
        const repository = store.getDrillRepository();
        const saved = drillId
          ? await renameNamedDrill(repository, drillId, name)
          : await createNamedDrill(repository, name);
        setDrill(saved);
        return saved;
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        operationInFlight.current = false;
        setSaving(false);
      }
    },
    [drillId, store],
  );

  const makeActive = React.useCallback(async () => {
    if (!drillId) return;
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await store.setActiveDrill(drillId);
    } catch (cause) {
      const operationError = toError(cause);
      setError(operationError);
      throw operationError;
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  }, [drillId, store]);

  const remove = React.useCallback(async () => {
    if (!drillId) return;
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await deleteDrillAndRefreshSettings(
        store.getDrillRepository(),
        drillId,
        () => store.reload(),
      );
    } catch (cause) {
      const operationError = toError(cause);
      setError(operationError);
      throw operationError;
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  }, [drillId, store]);

  return {
    drillId,
    drill,
    pages,
    loading: snapshot.status === "loading" || loading,
    saving,
    active: snapshot.settings.activeDrillId === drillId,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: error ?? snapshot.error,
    refresh,
    saveName,
    makeActive,
    remove,
  } as const;
}
